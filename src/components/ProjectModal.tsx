'use client';

import { useState } from 'react';
import { Project, Todo } from '@/types';

interface ProjectModalProps {
    project: Project;
    todos: Todo[];
    onClose: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onAddTodo: (description: string) => Promise<void>;
    onToggleTodo: (todo: Todo) => Promise<void>;
    onDeleteTodo: (todo: Todo) => Promise<void>;
    fontSizeLevel: number;
    getFontSizeClass: (baseClass: string) => string;
}

export default function ProjectModal({
    project,
    todos,
    onClose,
    onEdit,
    onDelete,
    onAddTodo,
    onToggleTodo,
    onDeleteTodo,
    fontSizeLevel,
    getFontSizeClass,
}: ProjectModalProps) {
    const [newTodoText, setNewTodoText] = useState('');
    const [addingTodo, setAddingTodo] = useState(false);

    const handleAddTodo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTodoText.trim()) return;
        setAddingTodo(true);
        try {
            await onAddTodo(newTodoText.trim());
            setNewTodoText('');
        } finally {
            setAddingTodo(false);
        }
    };

    const activeTodos = todos.filter((t) => !t.deleted);

    return (
        <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="bg-black rounded-lg shadow-2xl shadow-pink-700/40 w-full max-w-2xl
        border border-pink-300 max-h-[85vh] flex flex-col">

                {/* Header */}
                <div className="flex items-start justify-between px-6 py-4 border-b border-pink-600 shrink-0">
                    <div className="flex-1 min-w-0 mr-4">
                        <h2 className={getFontSizeClass('text-lg') + " font-semibold tracking-widest uppercase text-pink-300 truncate"}>
                            {project.name}
                        </h2>
                        {project.description && (
                            <p className={getFontSizeClass('text-sm') + " text-gray-500 mt-0.5"}>
                                {project.description}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={onEdit}
                            className="p-2 rounded text-gray-600 hover:text-pink-300 transition-colors"
                            title="Edit project"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-2 rounded text-gray-600 hover:text-red-500 transition-colors"
                            title="Delete project"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded text-gray-600 hover:text-pink-300 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Project Info */}
                <div className="px-6 py-3 border-b border-pink-700/50 shrink-0">
                    <div className={getFontSizeClass('text-xs') + " flex flex-wrap gap-2"}>
                        {project.language && (
                            <span className={getFontSizeClass('text-xs') + " px-2 py-1 rounded border border-white/10 text-gray-400 font-medium"}>
                                {project.language}
                            </span>
                        )}
                        <span className={getFontSizeClass('text-xs') + " px-2 py-1 rounded border border-white/10 text-gray-400"}>
                            Status: <span className={getFontSizeClass('text-xs') + " font-medium capitalize text-white"}>{project.status}</span>
                        </span>
                        {project.priority > 0 && (
                            <span className={getFontSizeClass('text-xs') + " px-2 py-1 rounded border border-orange-800/60 text-orange-400"}>
                                Priority: {project.priority}
                            </span>
                        )}
                        {project.path && (
                            <span className={getFontSizeClass('text-xs') + " px-2 py-1 rounded border border-white/10 text-gray-500 font-mono truncate max-w-xs"}>
                                {project.path}
                            </span>
                        )}
                    </div>
                </div>

                {/* Todos Section */}
                <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
                    <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-3">
                        Todos ({activeTodos.length})
                    </h3>

                    {/* Todo List */}
                    <div className="space-y-1.5">
                        {activeTodos.length === 0 && (
                            <p className="text-sm text-gray-600 italic py-4 text-center">
                                No todos yet. Add one below.
                            </p>
                        )}
                        {activeTodos.map((todo) => (
                            <div
                                key={todo.id}
                                className="flex items-start gap-2 group py-1.5 px-2 -mx-2 rounded hover:bg-white/5 transition-colors"
                            >
                                <button
                                    onClick={() => onDeleteTodo(todo)}
                                    className="mt-0.5 shrink-0 w-4 h-4 rounded border border-white/20
                    hover:border-red-500 hover:bg-red-900/30
                    flex items-center justify-center transition-colors"
                                    title="Delete todo"
                                >
                                    <svg className="w-2.5 h-2.5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                                <span className="text-sm text-gray-300 leading-snug flex-1">
                                    {todo.description}
                                </span>
                                {todo.priority > 0 && (
                                    <span className="text-[10px] font-medium text-orange-500 shrink-0">
                                        P{todo.priority}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add Todo Form */}
                <div className="px-6 py-3 border-t border-pink-600 shrink-0">
                    <form onSubmit={handleAddTodo} className="flex gap-2">
                        <input
                            type="text"
                            value={newTodoText}
                            onChange={(e) => setNewTodoText(e.target.value)}
                            placeholder="add a todo…"
                            className="flex-1 px-3 py-2 bg-transparent border border-white/20 rounded text-white text-sm
                placeholder-gray-600 focus:outline-none focus:border-pink-300 focus:ring-1 focus:ring-pink-300 transition-colors"
                            disabled={addingTodo}
                        />
                        <button
                            type="submit"
                            disabled={addingTodo || !newTodoText.trim()}
                            className="px-4 py-2 bg-pink-500 hover:bg-pink-400 text-white text-sm font-semibold
                rounded transition-colors disabled:opacity-40 uppercase tracking-wider"
                        >
                            Add
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
