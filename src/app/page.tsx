'use client';

import { useState, useEffect, Fragment } from 'react';
import { Project, Todo, KANBAN_COLUMNS, KanbanStatus, normalizeStatus } from '@/types';
import { kanbanColors, dragColors, pageColors, buttonColors, modalColors } from '@/lib/theme';
import {
  getProjects,
  getTodos,
  deleteProject,
  updateProjectStatus,
  createProject,
  updateProject,
  createTodo,
  updateTodo,
  deleteTodo,
  reorderProjects,
} from '@/lib/api';
import ProjectCard from '@/components/ProjectCard';
import ProjectModal from '@/components/ProjectModal';
import ProjectForm from '@/components/ProjectForm';

export default function KanbanPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [todos, setTodos] = useState<Record<number, Todo[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Font size slider (4 levels)
  const fontSizeLevels = ['text-xs', 'text-sm', 'text-base', 'text-lg'];
  const [fontSizeLevel, setFontSizeLevel] = useState(2); // Default: base

  // Helper to get relative font size class
  const getFontSizeClass = (baseClass: string) => {
    const idx = fontSizeLevels.indexOf(baseClass);
    const newIdx = Math.min(fontSizeLevels.length - 1, Math.max(0, idx + fontSizeLevel - 2));
    return fontSizeLevels[newIdx] || baseClass;
  };

  // Drag state – draggedId is only for visual styling; actual ID is read from dataTransfer in drop handlers
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<{
    column: KanbanStatus;
    cardId: number | null;
    position: 'before' | 'after';
  } | null>(null);


  // Modal state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // View mode: 'vertical' (kanban columns) or 'horizontal' (project rows) (persisted to localStorage)
  const [viewMode, setViewMode] = useState<'vertical' | 'horizontal'>(() => {
    try {
      const saved = localStorage.getItem('kanban-view-mode');
      if (saved === 'vertical' || saved === 'horizontal') return saved;
    } catch { /* ignore */ }
    return 'vertical';
  });

  // Column visibility state (persisted to localStorage)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    KANBAN_COLUMNS.forEach(({ key }) => { defaults[key] = true; });
    try {
      const saved = localStorage.getItem('kanban-visible-columns');
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, boolean>;
        // Merge with defaults so newly added columns default to visible
        return { ...defaults, ...parsed };
      }
    } catch { /* ignore */ }
    return defaults;
  });

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem('kanban-visible-columns', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const projectsData = await getProjects();
      setProjects(projectsData || []);

      // Load todos for all projects
      const todoMap: Record<number, Todo[]> = {};
      await Promise.all(
        (projectsData || []).map(async (p) => {
          try {
            const projectTodos = await getTodos(p.id);
            todoMap[p.id] = projectTodos || [];
          } catch {
            todoMap[p.id] = [];
          }
        })
      );
      setTodos(todoMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // ── Drag and Drop ──

  const handleDragStart = (projectId: number) => {
    setDraggedId(projectId);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOver(null);
  };

  // Called by each card's onDragOver
  const handleCardDragOver = (e: React.DragEvent, cardId: number, column: KanbanStatus) => {
    e.preventDefault();
    e.stopPropagation(); // prevent column handler from overriding cardId
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDragOver({ column, cardId, position });
  };

  // Single drop handler – handles both card-level (insert before/after) and column-level (append) drops
  const handleDrop = async (column: KanbanStatus, draggedId: number) => {
    const id = draggedId;
    if (!id) { setDragOver(null); return; }
    const sourceProject = projects.find(p => p.id === id);
    if (!sourceProject) { setDraggedId(null); setDragOver(null); return; }

    // Build new order for all columns
    const newOrder: Record<string, number[]> = {};
    KANBAN_COLUMNS.forEach(({ key }) => {
      // Get current projects in this column, sorted by position
      const colProjects = projects
        .filter(p => normalizeStatus(p.status) === key && p.id !== id)
        .sort((a, b) => a.position - b.position)
        .map(p => p.id);
      newOrder[key] = colProjects;
    });

    // Insert dragged project into target column at correct position
    const targetArr = newOrder[column];
    const snap = dragOver;
    let insertAt = targetArr.length;
    if (snap && snap.column === column && snap.cardId !== null) {
      const idx = targetArr.indexOf(snap.cardId);
      insertAt = idx < 0 ? targetArr.length : (snap.position === 'before' ? idx : idx + 1);
    }
    targetArr.splice(insertAt, 0, id);

    // Optimistic update - update local state immediately
    const updatedProjects = projects.map(p => {
      for (const [status, ids] of Object.entries(newOrder)) {
        const pos = ids.indexOf(p.id);
        if (pos !== -1) {
          return { ...p, status, position: pos };
        }
      }
      return p;
    });
    setProjects(updatedProjects);

    setDraggedId(null);
    setDragOver(null);

    // Persist to server
    try {
      const serverProjects = await reorderProjects(newOrder);
      setProjects(serverProjects);
    } catch (err) {
      // Revert on error
      console.error('Failed to reorder projects:', err);
      loadData();
    }
  };

  // ── Project CRUD ──

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this project and all its todos?')) return;
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setSelectedProject(null);
    } catch {
      alert('Failed to delete project');
    }
  };

  const handleCreate = async (data: Partial<Project>) => {
    try {
      const created = await createProject(data);
      setProjects((prev) => [...prev, created]);
      setTodos((prev) => ({ ...prev, [created.id]: [] }));
      setShowCreateModal(false);
    } catch (err) {
      alert('Failed to create project: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleUpdate = async (data: Partial<Project>) => {
    if (!editingProject) return;
    try {
      const updated = await updateProject(editingProject.id, {
        ...editingProject,
        ...data,
      });
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      if (selectedProject?.id === updated.id) {
        setSelectedProject(updated);
      }
      setEditingProject(null);
    } catch (err) {
      alert('Failed to update project: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // ── Todo CRUD ──

  const handleAddTodo = async (projectId: number, description: string) => {
    try {
      const created = await createTodo({
        description,
        priority: 0,
        project_id: projectId,
      });
      setTodos((prev) => ({
        ...prev,
        [projectId]: [...(prev[projectId] || []), created],
      }));
    } catch {
      alert('Failed to create todo');
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    try {
      const updated = await updateTodo(todo.id, {
        ...todo,
        deleted: !todo.deleted,
      });
      setTodos((prev) => ({
        ...prev,
        [todo.project_id!]: (prev[todo.project_id!] || []).map((t) =>
          t.id === todo.id ? updated : t
        ),
      }));
    } catch {
      alert('Failed to update todo');
    }
  };

  const handleDeleteTodo = async (todo: Todo) => {
    try {
      await deleteTodo(todo.id);
      setTodos((prev) => ({
        ...prev,
        [todo.project_id!]: (prev[todo.project_id!] || []).filter(
          (t) => t.id !== todo.id
        ),
      }));
    } catch {
      alert('Failed to delete todo');
    }
  };

  // ── Column helpers ──

  const getColumnProjects = (column: KanbanStatus): Project[] => {
    // Filter projects by status and sort by position (from server)
    return projects
      .filter(p => normalizeStatus(p.status) === column)
      .sort((a, b) => a.position - b.position);
  };

  // ── Render ──

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${pageColors.loadingSpinner}`}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] gap-4">
        <p className={`${pageColors.errorText} text-lg`}>{error}</p>
        <button
          onClick={loadData}
          className={`${buttonColors.primary} font-medium py-2 px-6 rounded-lg transition-colors`}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={getFontSizeClass('text-base')}>
      {/* Header */}
      <div className="flex mb-6 px-4 items-center">
        <div className="flex-1 flex items-center">
          {/* View Mode Toggle Button */}
          <button
            onClick={() => setViewMode(prev => {
              const next = prev === 'vertical' ? 'horizontal' : 'vertical';
              try { localStorage.setItem('kanban-view-mode', next); } catch { /* ignore */ }
              return next;
            })}
            title={viewMode === 'vertical' ? 'Switch to horizontal view' : 'Switch to vertical view'}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center transition-all duration-150 focus:outline-none mr-3 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            {viewMode === 'vertical' ? (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            )}
          </button>
          {/* Column/Row Toggle Buttons - visible in both modes */}
          <div className="flex gap-2">
            {KANBAN_COLUMNS.map(({ key }, idx) => {
              const borderGray = !visibleColumns[key] ? modalColors.borderGrayDark : kanbanColors[key].border;
              return (
                <button
                  key={key}
                  title={`Toggle ${key}`}
                  onClick={() => toggleColumn(key)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border-2 flex items-center justify-center transition-all duration-150 focus:outline-none ${kanbanColors[key].bg} ${borderGray} ${kanbanColors[key].header}`}
                  style={{
                    boxShadow: visibleColumns[key] ? `0 0 0 2px ${kanbanColors[key].border.split(' ')[1] || '#000'}` : 'none',
                    position: 'relative',
                  }}
                >
                  {/* Icon: eye open/closed */}
                  {visibleColumns[key] ? (
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0zm7 0c-1.5 4-6 7-10 7S3.5 16 2 12c1.5-4 6-7 10-7s8.5 3 10 7z" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18M9.88 9.88A3 3 0 0012 15a3 3 0 002.12-5.12M21 12c-1.5 4-6 7-10 7a9.77 9.77 0 01-7.17-3.06M6.53 6.53A9.77 9.77 0 0112 5c4 0 8.5 3 10 7a9.77 9.77 0 01-1.06 2.11" />
                    </svg>
                  )}
                  {!visibleColumns[key] && (
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '9999px',
                        background: modalColors.toggleButtonGray,
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p className={`${getFontSizeClass('text-lg')} font-bold ${pageColors.headerSubtitle} hidden sm:block ml-4 text-center w-full`}>
            {projects.length} projects
          </p>
        </div>
        <div className="flex items-center gap-4 ml-auto">
          {/* Text Size Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFontSizeLevel(prev => Math.max(0, prev - 1))}
              disabled={fontSizeLevel === 0}
              className="w-6 h-6 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Decrease text size"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <span className={getFontSizeClass('text-xs') + ' font-bold min-w-[2rem] text-center'}>{['XS', 'SM', 'MD', 'LG'][fontSizeLevel]}</span>
            <button
              onClick={() => setFontSizeLevel(prev => Math.min(3, prev + 1))}
              disabled={fontSizeLevel === 3}
              className="w-6 h-6 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Increase text size"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-lg font-bold bg-pink-500/50 hover:bg-pink-500/75 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Kanban Board - Vertical View */}
      {viewMode === 'vertical' && (
        <div className={`grid gap-4 px-4 h-[calc(100vh-12rem)] min-h-0`} style={{ gridTemplateColumns: `repeat(${KANBAN_COLUMNS.filter(({ key }) => visibleColumns[key]).length}, minmax(0, 1fr))` }}>
          {KANBAN_COLUMNS.filter(({ key }) => visibleColumns[key]).map(({ key, label }) => {
            const colProjects = getColumnProjects(key);
            const colors = kanbanColors[key];
            const isDropTarget = dragOver?.column === key;

            return (
              <div
                key={key}
                className={`flex flex-col rounded-xl border-2 transition-all duration-200 ${isDropTarget
                  ? `${colors.dropzone} border-dashed scale-[1.01]`
                  : `${colors.bg} ${colors.border}`
                  }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(prev => {
                    if (prev?.column === key && prev?.cardId !== null) return prev;
                    return { column: key, cardId: null, position: 'after' };
                  });
                }}
                onDragLeave={(e) => {
                  // Only clear when truly leaving the column (not moving to a child)
                  if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
                  setDragOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = parseInt(e.dataTransfer.getData('text/plain'));
                  if (!isNaN(id)) handleDrop(key, id);
                }}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-inherit gap-2">
                  <h2 className={`font-semibold ${getFontSizeClass('text-sm')} uppercase tracking-wider ${colors.header} overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent flex-1 min-w-0`}>
                    {label}
                  </h2>
                  <span className={`${getFontSizeClass('text-xs')} font-bold px-2 py-0.5 rounded-full ${colors.count} shrink-0`}>
                    {colProjects.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                  {colProjects.map((project) => {
                    const isTarget = dragOver?.column === key && dragOver?.cardId === project.id;
                    const isDragging = draggedId === project.id;
                    return (
                      <Fragment key={project.id}>
                        {isTarget && dragOver!.position === 'before' && (
                          <div className={`h-0.5 ${dragColors.dropIndicator} rounded-full shadow-sm shadow-blue-400`} />
                        )}
                        <ProjectCard
                          project={project}
                          todoCount={todos[project.id]?.length || 0}
                          isDragging={isDragging}
                          fontSizeLevel={fontSizeLevel}
                          getFontSizeClass={getFontSizeClass}
                          onDragStart={() => handleDragStart(project.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleCardDragOver(e, project.id, key)}
                          onClick={() => { if (!isDragging) setSelectedProject(project); }}
                          onDelete={() => handleDelete(project.id)}
                          onEdit={() => setEditingProject(project)}
                        />
                        {isTarget && dragOver!.position === 'after' && (
                          <div className={`h-0.5 ${dragColors.dropIndicator} rounded-full shadow-sm shadow-blue-400`} />
                        )}
                      </Fragment>
                    );
                  })}

                  {colProjects.length === 0 && (
                    <div className={`flex items-center justify-center h-24 ${pageColors.emptyText} text-sm italic`}>
                      Drop projects here
                    </div>
                  )}

                  {/* End-of-column drop indicator */}
                  {isDropTarget && dragOver?.cardId === null && colProjects.length > 0 && (
                    <div className={`h-0.5 ${dragColors.dropIndicator} rounded-full shadow-sm shadow-blue-400`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Horizontal View - Project Rows */}
      {viewMode === 'horizontal' && (
        <div className="px-4 overflow-y-auto h-[calc(100vh-12rem)] space-y-4">
          {KANBAN_COLUMNS.filter(({ key }) => visibleColumns[key]).map(({ key, label }) => {
            const colProjects = getColumnProjects(key);
            const colors = kanbanColors[key];
            const isDropTarget = dragOver?.column === key;
            if (colProjects.length === 0 && !isDropTarget) return null;

            return (
              <div
                key={key}
                className={`rounded-xl border-2 p-4 transition-all duration-200 ${isDropTarget
                  ? `${colors.dropzone} border-dashed scale-[1.005]`
                  : `${colors.bg} ${colors.border}`
                  }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(prev => {
                    if (prev?.column === key && prev?.cardId !== null) return prev;
                    return { column: key, cardId: null, position: 'after' };
                  });
                }}
                onDragLeave={(e) => {
                  if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
                  setDragOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = parseInt(e.dataTransfer.getData('text/plain'));
                  if (!isNaN(id)) handleDrop(key, id);
                }}
              >
                {/* Row Header */}
                <div className="flex items-center gap-3 mb-3">
                  <h2 className={`font-bold ${getFontSizeClass('text-base')} uppercase tracking-wider ${colors.header}`}>
                    {label}
                  </h2>
                  <span className={`${getFontSizeClass('text-xs')} font-bold px-2 py-0.5 rounded-full ${colors.count}`}>
                    {colProjects.length}
                  </span>
                </div>

                {/* Cards in a wrapping flex row */}
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {colProjects.map((project) => {
                    const isTarget = dragOver?.column === key && dragOver?.cardId === project.id;
                    const isDragging = draggedId === project.id;
                    return (
                      <Fragment key={project.id}>
                        {isTarget && dragOver!.position === 'before' && (
                          <div className={`w-1 self-stretch ${dragColors.dropIndicator} rounded-full shadow-sm shadow-blue-400`} />
                        )}
                        <div
                          className="w-[calc(50%-0.25rem)] sm:w-48 md:w-56 lg:w-64 flex-shrink-0"
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const position: 'before' | 'after' = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                            setDragOver({ column: key, cardId: project.id, position });
                          }}
                        >
                          <ProjectCard
                            project={project}
                            todoCount={todos[project.id]?.length || 0}
                            isDragging={isDragging}
                            fontSizeLevel={fontSizeLevel}
                            getFontSizeClass={getFontSizeClass}
                            onDragStart={() => handleDragStart(project.id)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            onClick={() => { if (!isDragging) setSelectedProject(project); }}
                            onDelete={() => handleDelete(project.id)}
                            onEdit={() => setEditingProject(project)}
                          />
                        </div>
                        {isTarget && dragOver!.position === 'after' && (
                          <div className={`w-1 self-stretch ${dragColors.dropIndicator} rounded-full shadow-sm shadow-blue-400`} />
                        )}
                      </Fragment>
                    );
                  })}

                  {colProjects.length === 0 && (
                    <div className={`flex items-center justify-center h-16 w-full ${pageColors.emptyText} text-sm italic`}>
                      Drop projects here
                    </div>
                  )}

                  {/* End-of-row drop indicator */}
                  {isDropTarget && dragOver?.cardId === null && colProjects.length > 0 && (
                    <div className={`w-1 self-stretch ${dragColors.dropIndicator} rounded-full shadow-sm shadow-blue-400`} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Project Detail Modal */}
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          todos={todos[selectedProject.id] || []}
          fontSizeLevel={fontSizeLevel}
          getFontSizeClass={getFontSizeClass}
          onClose={() => setSelectedProject(null)}
          onEdit={() => {
            setEditingProject(selectedProject);
            setSelectedProject(null);
          }}
          onDelete={() => handleDelete(selectedProject.id)}
          onAddTodo={(desc) => handleAddTodo(selectedProject.id, desc)}
          onToggleTodo={handleToggleTodo}
          onDeleteTodo={handleDeleteTodo}
        />
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className={typeof getFontSizeClass === 'function' ? getFontSizeClass('text-xl') + " font-bold text-gray-900 dark:text-white" : "text-xl font-bold text-gray-900 dark:text-white"}>New Project</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <ProjectForm
                fontSizeLevel={fontSizeLevel}
                getFontSizeClass={getFontSizeClass}
                onSubmit={handleCreate}
                onCancel={() => setShowCreateModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setEditingProject(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className={getFontSizeClass('text-xl') + " font-bold text-gray-900 dark:text-white"}>Edit Project</h2>
              <button onClick={() => setEditingProject(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <ProjectForm
                project={editingProject}
                fontSizeLevel={fontSizeLevel}
                getFontSizeClass={getFontSizeClass}
                onSubmit={handleUpdate}
                onCancel={() => setEditingProject(null)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
