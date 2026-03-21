'use client';

import { useState, useEffect, useCallback, useRef, Fragment } from 'react';
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
import { useToast } from '@/components/Toast';

export default function KanbanPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [todos, setTodos] = useState<Record<number, Todo[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast, success, error: toastError, confirm } = useToast();
  const hasAnimated = useRef(false);
  const [animating, setAnimating] = useState(false);
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

  // Touch drag state
  const touchDragRef = useRef<{
    projectId: number;
    cardRect: DOMRect;
    targetColumn: KanbanStatus | null;
  } | null>(null);
  const [touchDragPos, setTouchDragPos] = useState<{ x: number; y: number } | null>(null);
  const touchDragging = touchDragPos !== null;


  // Modal state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // ── Keyboard navigation mode ──
  const [kbMode, setKbMode] = useState(false);
  const [focusCol, setFocusCol] = useState(0);
  const [focusIdx, setFocusIdx] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);

  // ── Focus mode: expand a single column ──
  const [focusedColumn, setFocusedColumn] = useState<KanbanStatus | null>(null);
  const toggleFocusColumn = (key: KanbanStatus) => {
    setFocusedColumn(prev => prev === key ? null : key);
  };

  // ── Quick-add project inline in column ──
  const [quickAddColumn, setQuickAddColumn] = useState<KanbanStatus | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const quickAddRef = useRef<HTMLInputElement>(null);

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
      // Trigger entrance animations on first load only
      if (!hasAnimated.current) {
        hasAnimated.current = true;
        setAnimating(true);
        setTimeout(() => setAnimating(false), 2000); // Clear after all animations finish
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper to get visible columns list
  const getVisibleCols = useCallback(() => {
    return KANBAN_COLUMNS.filter(({ key }) => visibleColumns[key]);
  }, [visibleColumns]);

  // Helper to get the focused project
  const getFocusedProject = useCallback(() => {
    const visCols = getVisibleCols();
    if (visCols.length === 0) return null;
    const col = visCols[Math.min(focusCol, visCols.length - 1)];
    const colProjects = projects
      .filter(p => normalizeStatus(p.status) === col.key)
      .sort((a, b) => a.position - b.position);
    if (colProjects.length === 0) return null;
    return colProjects[Math.min(focusIdx, colProjects.length - 1)] || null;
  }, [getVisibleCols, focusCol, focusIdx, projects]);

  // Keyboard navigation + Escape handler
  useEffect(() => {
    const hasModal = !!(editingProject || showCreateModal || selectedProject);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Always handle Escape regardless of mode
      if (e.key === 'Escape') {
        if (editingProject) { setEditingProject(null); return; }
        if (showCreateModal) { setShowCreateModal(false); return; }
        if (selectedProject) { setSelectedProject(null); return; }
        if (focusedColumn) { setFocusedColumn(null); return; }
        if (kbMode) { setKbMode(false); return; }
        return;
      }

      // Tab toggles keyboard mode (only when no modal is open)
      if (e.key === 'Tab' && !hasModal) {
        e.preventDefault();
        setKbMode(prev => !prev);
        return;
      }

      // All other keys only work in kb mode and when no modal is open
      if (!kbMode || hasModal) return;

      const visCols = getVisibleCols();
      if (visCols.length === 0) return;

      const clampedCol = Math.min(focusCol, visCols.length - 1);
      const col = visCols[clampedCol];
      const colProjects = projects
        .filter(p => normalizeStatus(p.status) === col.key)
        .sort((a, b) => a.position - b.position);

      switch (e.key) {
        case 'ArrowRight': {
          e.preventDefault();
          const newCol = Math.min(clampedCol + 1, visCols.length - 1);
          setFocusCol(newCol);
          setFocusIdx(0);
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const newCol = Math.max(clampedCol - 1, 0);
          setFocusCol(newCol);
          setFocusIdx(0);
          break;
        }
        case 'ArrowDown': {
          e.preventDefault();
          setFocusIdx(prev => Math.min(prev + 1, colProjects.length - 1));
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setFocusIdx(prev => Math.max(prev - 1, 0));
          break;
        }
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const fp = colProjects[Math.min(focusIdx, colProjects.length - 1)];
          if (fp) setSelectedProject(fp);
          break;
        }
        case 'e':
        case 'E': {
          e.preventDefault();
          const fp = colProjects[Math.min(focusIdx, colProjects.length - 1)];
          if (fp) setEditingProject(fp);
          break;
        }
        case 'd':
        case 'D': {
          e.preventDefault();
          const fp = colProjects[Math.min(focusIdx, colProjects.length - 1)];
          if (fp) handleDelete(fp.id);
          break;
        }
        case 'n':
        case 'N': {
          e.preventDefault();
          setShowCreateModal(true);
          break;
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [kbMode, focusCol, focusIdx, editingProject, showCreateModal, selectedProject, focusedColumn, projects, getVisibleCols]);

  // Auto-scroll focused card into view
  useEffect(() => {
    if (!kbMode) return;
    const fp = getFocusedProject();
    if (!fp) return;
    const el = document.querySelector(`[data-project-id="${fp.id}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [kbMode, focusCol, focusIdx, getFocusedProject]);

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

  // Keep a ref to handleDrop that's always fresh — avoids stale closure in touch listeners
  const handleDropRef = useRef(handleDrop);
  useEffect(() => { handleDropRef.current = handleDrop; });

  const handleTouchDragStart = useCallback((
    projectId: number,
    clientX: number,
    clientY: number,
    cardRect: DOMRect
  ) => {
    touchDragRef.current = { projectId, cardRect, targetColumn: null };
    setDraggedId(projectId);
    setTouchDragPos({ x: clientX, y: clientY });
  }, []);

  // Global touch move/end listeners — only active while a touch drag is in progress
  useEffect(() => {
    if (!touchDragging) return;

    const onMove = (e: TouchEvent) => {
      e.preventDefault(); // block page scroll while dragging
      const touch = e.touches[0];
      setTouchDragPos({ x: touch.clientX, y: touch.clientY });

      // All elements under the finger, excluding the floating clone
      const elements = (document.elementsFromPoint(touch.clientX, touch.clientY) as HTMLElement[])
        .filter(el => !el.closest('[data-drag-clone]'));

      // Find target column
      const colEl = elements.find(el => el.hasAttribute('data-column'))
        ?? (elements.map(el => el.closest('[data-column]') as HTMLElement | null).find(Boolean) ?? null);
      const col = colEl?.getAttribute('data-column') as KanbanStatus | undefined;
      if (!col) return;

      if (touchDragRef.current) touchDragRef.current.targetColumn = col;

      // Find card wrapper under finger (skip the card being dragged)
      const cardWrapper = (
        elements.find(el => el.hasAttribute('data-project-id'))
        ?? (elements.map(el => el.closest('[data-project-id]') as HTMLElement | null).find(Boolean) ?? null)
      );
      const cardId = cardWrapper ? parseInt(cardWrapper.getAttribute('data-project-id')!) : NaN;

      if (!isNaN(cardId) && cardId !== touchDragRef.current?.projectId) {
        const rect = cardWrapper!.getBoundingClientRect();
        const position: 'before' | 'after' = touch.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        setDragOver({ column: col, cardId, position });
      } else {
        setDragOver({ column: col, cardId: null, position: 'after' });
      }
    };

    const onEnd = () => {
      const ref = touchDragRef.current;
      if (ref?.targetColumn) {
        handleDropRef.current(ref.targetColumn, ref.projectId);
      } else {
        setDraggedId(null);
        setDragOver(null);
      }
      touchDragRef.current = null;
      setTouchDragPos(null);
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [touchDragging]);

  // ── Project CRUD ──

  const handleDelete = async (id: number) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    confirm(`Delete "${project.name}" and all its todos?`, async () => {
      try {
        await deleteProject(id);
        setProjects(prev => prev.filter(p => p.id !== id));
        setSelectedProject(null);
        success(`Deleted "${project.name}"`);
      } catch {
        toastError('Failed to delete project');
      }
    });
  };

  const handleCreate = async (data: Partial<Project>) => {
    try {
      const created = await createProject(data);
      setProjects((prev) => [...prev, created]);
      setTodos((prev) => ({ ...prev, [created.id]: [] }));
      setShowCreateModal(false);
      success(`Created "${created.name}"`);
    } catch (err) {
      toastError('Failed to create project: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleQuickCreate = async (column: KanbanStatus) => {
    const name = quickAddName.trim();
    if (!name) {
      setQuickAddColumn(null);
      setQuickAddName('');
      return;
    }
    try {
      const created = await createProject({ name, status: column });
      setProjects((prev) => [...prev, created]);
      setTodos((prev) => ({ ...prev, [created.id]: [] }));
      success(`Created "${created.name}"`);
    } catch (err) {
      toastError('Failed to create project: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
    setQuickAddColumn(null);
    setQuickAddName('');
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
      success('Project updated');
    } catch (err) {
      toastError('Failed to update project: ' + (err instanceof Error ? err.message : 'Unknown error'));
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
      toastError('Failed to create todo');
    }
  };

  const handleToggleTodo = async (todo: Todo) => {
    try {
      const updated = await updateTodo(todo.id, {
        ...todo,
        checked: !todo.checked,
      });
      setTodos((prev) => ({
        ...prev,
        [todo.project_id!]: (prev[todo.project_id!] || []).map((t) =>
          t.id === todo.id ? updated : t
        ),
      }));
    } catch {
      toastError('Failed to update todo');
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
      toastError('Failed to delete todo');
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
    <div className={`flex flex-col h-full ` + getFontSizeClass('text-base') + (kbMode ? ' cursor-none' : '')}>
      {/* Keyboard mode indicator */}
      {kbMode && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] px-4 py-1.5 rounded-full bg-pink-500/20 border border-pink-400/50 backdrop-blur-sm flex items-center gap-2 text-pink-300 text-xs font-mono tracking-wider select-none pointer-events-none">
          <span>⌨ KB MODE</span>
          <span className="text-gray-500">│</span>
          <span className="text-gray-400">← → ↑ ↓ navigate</span>
          <span className="text-gray-500">│</span>
          <span className="text-gray-400">↵ open · E edit · D del · N new · Tab exit</span>
        </div>
      )}
      {/* Focus mode indicator */}
      {focusedColumn && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] px-4 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/50 backdrop-blur-sm flex items-center gap-2 text-blue-300 text-xs font-mono tracking-wider select-none">
          <span>◉ FOCUS</span>
          <span className="text-gray-500">│</span>
          <span className="text-gray-400 capitalize">{focusedColumn}</span>
          <span className="text-gray-500">│</span>
          <button
            onClick={() => setFocusedColumn(null)}
            className="text-gray-400 hover:text-blue-300 transition-colors pointer-events-auto"
          >
            Esc to exit
          </button>
        </div>
      )}
      {/* Header */}
      <div className={`flex mb-6 px-4 items-center ${animating ? 'animate-header-in' : ''}`}>
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
      {viewMode === 'vertical' && (() => {
        const filteredCols = KANBAN_COLUMNS.filter(({ key }) => visibleColumns[key] && (!focusedColumn || key === focusedColumn));
        return (
          <div className={`grid gap-4 px-4 flex-1 min-h-0`} style={{ gridTemplateColumns: `repeat(${filteredCols.length}, minmax(0, 1fr))` }}>
            {filteredCols.map(({ key, label }, colIdx) => {
              const colProjects = getColumnProjects(key);
              const colors = kanbanColors[key];
              const isDropTarget = dragOver?.column === key;
              const isFocused = focusedColumn === key;

              return (
                <div
                  key={key}
                  data-column={key}
                  className={`flex flex-col rounded-xl border-2 transition-all duration-200 ${isDropTarget
                    ? `${colors.dropzone} border-dashed scale-[1.01]`
                    : `${colors.bg} ${colors.border}`
                    } ${animating ? 'animate-column-in' : ''} ${isFocused ? 'animate-focus-expand' : ''}`}
                  style={animating ? { animationDelay: `${colIdx * 80}ms` } : undefined}
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
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b border-inherit gap-2 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => toggleFocusColumn(key)}
                    title={focusedColumn === key ? 'Exit focus mode (Esc)' : `Focus on ${label}`}
                  >
                    <h2 className={`font-semibold ${getFontSizeClass('text-sm')} uppercase tracking-wider ${colors.header} overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent flex-1 min-w-0`}>
                      {focusedColumn === key && (
                        <span className="mr-2 text-pink-400" title="Focus mode — click to exit">◉</span>
                      )}
                      {label}
                    </h2>
                    <span className={`${getFontSizeClass('text-xs')} font-bold px-2 py-0.5 rounded-full ${colors.count} shrink-0`}>
                      {colProjects.length}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                    {colProjects.map((project, cardIdx) => {
                      const isTarget = dragOver?.column === key && dragOver?.cardId === project.id;
                      const isDragging = draggedId === project.id;
                      return (
                        <Fragment key={project.id}>
                          {isTarget && dragOver!.position === 'before' && (
                            <div className={`h-0.5 ${dragColors.dropIndicator} rounded-full shadow-sm shadow-blue-400`} />
                          )}
                          <div data-project-id={project.id} className="card-container">
                            <ProjectCard
                              project={project}
                              todoCount={todos[project.id]?.length || 0}
                              todos={todos[project.id] || []}
                              isDragging={isDragging}
                              isFocused={kbMode && getFocusedProject()?.id === project.id}
                              fontSizeLevel={fontSizeLevel}
                              getFontSizeClass={getFontSizeClass}
                              animationDelay={animating ? (colIdx * 80) + (cardIdx * 50) + 100 : undefined}
                              onDragStart={() => handleDragStart(project.id)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => handleCardDragOver(e, project.id, key)}
                              onTouchDragStart={handleTouchDragStart}
                              onClick={() => { if (!isDragging) setSelectedProject(project); }}
                              onDelete={() => handleDelete(project.id)}
                              onEdit={() => setEditingProject(project)}
                            />
                          </div>
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

                    {/* Quick-add project button */}
                    {quickAddColumn === key ? (
                      <input
                        ref={quickAddRef}
                        type="text"
                        autoFocus
                        placeholder="Project name…"
                        value={quickAddName}
                        onChange={(e) => setQuickAddName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleQuickCreate(key);
                          if (e.key === 'Escape') { setQuickAddColumn(null); setQuickAddName(''); }
                        }}
                        onBlur={() => { setQuickAddColumn(null); setQuickAddName(''); }}
                        className={`w-full px-3 py-2 rounded-lg border-2 border-dashed ${colors.addButtonBorder} ${colors.addButton} ${colors.addButtonText} bg-transparent text-sm placeholder-current/50 outline-none focus:border-opacity-80 transition-colors`}
                      />
                    ) : (
                      <button
                        onClick={() => { setQuickAddColumn(key); setQuickAddName(''); }}
                        className={`w-full flex items-center justify-center py-2 rounded-lg border-2 border-dashed ${colors.addButtonBorder} ${colors.addButton} ${colors.addButtonText} ${colors.addButtonHover} transition-all duration-150 cursor-pointer`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Horizontal View - Project Rows */}
      {viewMode === 'horizontal' && (
        <div className="px-4 overflow-y-auto flex-1 min-h-0 space-y-4">
          {KANBAN_COLUMNS.filter(({ key }) => visibleColumns[key] && (!focusedColumn || key === focusedColumn)).map(({ key, label }, colIdx) => {
            const colProjects = getColumnProjects(key);
            const colors = kanbanColors[key];
            const isDropTarget = dragOver?.column === key;
            const isFocused = focusedColumn === key;
            if (colProjects.length === 0 && !isDropTarget) return null;

            return (
              <div
                key={key}
                data-column={key}
                className={`rounded-xl border-2 p-4 transition-all duration-200 ${isDropTarget
                  ? `${colors.dropzone} border-dashed scale-[1.005]`
                  : `${colors.bg} ${colors.border}`
                  } ${animating ? 'animate-column-in' : ''} ${isFocused ? 'animate-focus-expand' : ''}`}
                style={animating ? { animationDelay: `${colIdx * 100}ms` } : undefined}
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
                <div
                  className="flex items-center gap-3 mb-3 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => toggleFocusColumn(key)}
                  title={focusedColumn === key ? 'Exit focus mode (Esc)' : `Focus on ${label}`}
                >
                  <h2 className={`font-bold ${getFontSizeClass('text-base')} uppercase tracking-wider ${colors.header}`}>
                    {focusedColumn === key && (
                      <span className="mr-2 text-pink-400" title="Focus mode — click to exit">◉</span>
                    )}
                    {label}
                  </h2>
                  <span className={`${getFontSizeClass('text-xs')} font-bold px-2 py-0.5 rounded-full ${colors.count}`}>
                    {colProjects.length}
                  </span>
                </div>

                {/* Cards in a wrapping flex row */}
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {colProjects.map((project, cardIdx) => {
                    const isTarget = dragOver?.column === key && dragOver?.cardId === project.id;
                    const isDragging = draggedId === project.id;
                    return (
                      <Fragment key={project.id}>
                        {isTarget && dragOver!.position === 'before' && (
                          <div className={`w-1 self-stretch ${dragColors.dropIndicator} rounded-full shadow-sm shadow-blue-400`} />
                        )}
                        <div
                          className="w-[calc(50%-0.25rem)] sm:w-48 md:w-56 lg:w-64 flex-shrink-0 card-container"
                          data-project-id={project.id}
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
                            todos={todos[project.id] || []}
                            isDragging={isDragging}
                            isFocused={kbMode && getFocusedProject()?.id === project.id}
                            fontSizeLevel={fontSizeLevel}
                            getFontSizeClass={getFontSizeClass}
                            animationDelay={animating ? (colIdx * 100) + (cardIdx * 50) + 120 : undefined}
                            onDragStart={() => handleDragStart(project.id)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => e.preventDefault()}
                            onTouchDragStart={handleTouchDragStart}
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

                  {/* Quick-add project button */}
                  {quickAddColumn === key ? (
                    <div className="w-[calc(50%-0.25rem)] sm:w-48 md:w-56 lg:w-64 flex-shrink-0">
                      <input
                        ref={quickAddRef}
                        type="text"
                        autoFocus
                        placeholder="Project name…"
                        value={quickAddName}
                        onChange={(e) => setQuickAddName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleQuickCreate(key);
                          if (e.key === 'Escape') { setQuickAddColumn(null); setQuickAddName(''); }
                        }}
                        onBlur={() => { setQuickAddColumn(null); setQuickAddName(''); }}
                        className={`w-full px-3 py-2 rounded-lg border-2 border-dashed ${colors.addButtonBorder} ${colors.addButton} ${colors.addButtonText} bg-transparent text-sm placeholder-current/50 outline-none focus:border-opacity-80 transition-colors`}
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => { setQuickAddColumn(key); setQuickAddName(''); }}
                      className={`w-[calc(50%-0.25rem)] sm:w-48 md:w-56 lg:w-64 flex-shrink-0 flex items-center justify-center py-2 rounded-lg border-2 border-dashed ${colors.addButtonBorder} ${colors.addButton} ${colors.addButtonText} ${colors.addButtonHover} transition-all duration-150 cursor-pointer`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowCreateModal(false)}>
          <div className="bg-black rounded-lg shadow-2xl shadow-pink-700/40 w-full max-w-lg border border-pink-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-pink-600">
              <h2 className={getFontSizeClass('text-lg') + " font-semibold tracking-widest uppercase text-pink-300"}>New Project</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-600 hover:text-pink-300 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setEditingProject(null)}>
          <div className="bg-black rounded-lg shadow-2xl shadow-pink-700/40 w-full max-w-lg border border-pink-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-pink-600">
              <h2 className={getFontSizeClass('text-lg') + " font-semibold tracking-widest uppercase text-pink-300"}>Edit Project</h2>
              <button onClick={() => setEditingProject(null)} className="text-gray-600 hover:text-pink-300 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Floating clone shown under the finger during touch drag */}
      {touchDragPos && touchDragRef.current && (() => {
        const p = projects.find(pr => pr.id === touchDragRef.current!.projectId);
        if (!p) return null;
        const { cardRect } = touchDragRef.current;
        return (
          <div
            data-drag-clone="true"
            className="fixed z-[200] pointer-events-none select-none rounded-lg border border-pink-400/60 bg-zinc-900/95 p-3 shadow-2xl shadow-pink-500/30"
            style={{
              left: touchDragPos.x - cardRect.width / 2,
              top: touchDragPos.y - cardRect.height * 0.35,
              width: cardRect.width,
              transform: 'rotate(2deg) scale(1.04)',
              opacity: 0.88,
            }}
          >
            <p className="text-white font-semibold text-sm truncate">{p.name}</p>
            {p.description && (
              <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{p.description}</p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
