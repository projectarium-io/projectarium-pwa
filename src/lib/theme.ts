import { KanbanStatus } from '@/types';

// ── Kanban Column Colors ──
export const kanbanColors: Record<KanbanStatus, {
    bg: string;
    border: string;
    header: string;
    count: string;
    dropzone: string;
    addButton: string;
    addButtonBorder: string;
    addButtonText: string;
    addButtonHover: string;
}> = {
    abandoned: {
        bg: 'bg-black',
        border: 'border-red-800',
        header: 'text-red-400',
        count: 'bg-red-900 text-red-300',
        dropzone: 'bg-red-900/30 border-red-600',
        addButton: 'bg-red-950/40',
        addButtonBorder: 'border-red-700/50',
        addButtonText: 'text-red-500',
        addButtonHover: 'hover:bg-red-900/40 hover:border-red-600/60',
    },
    backlog: {
        bg: 'bg-black',
        border: 'border-amber-800',
        header: 'text-amber-400',
        count: 'bg-amber-900 text-amber-300',
        dropzone: 'bg-amber-900/30 border-amber-600',
        addButton: 'bg-amber-950/40',
        addButtonBorder: 'border-amber-700/50',
        addButtonText: 'text-amber-500',
        addButtonHover: 'hover:bg-amber-900/40 hover:border-amber-600/60',
    },
    active: {
        bg: 'bg-black',
        border: 'border-blue-800',
        header: 'text-blue-400',
        count: 'bg-blue-900 text-blue-300',
        dropzone: 'bg-blue-900/30 border-blue-600',
        addButton: 'bg-blue-950/40',
        addButtonBorder: 'border-blue-700/50',
        addButtonText: 'text-blue-500',
        addButtonHover: 'hover:bg-blue-900/40 hover:border-blue-600/60',
    },
    completed: {
        bg: 'bg-black',
        border: 'border-emerald-800',
        header: 'text-emerald-400',
        count: 'bg-emerald-900 text-emerald-300',
        dropzone: 'bg-emerald-900/30 border-emerald-600',
        addButton: 'bg-emerald-950/40',
        addButtonBorder: 'border-emerald-700/50',
        addButtonText: 'text-emerald-500',
        addButtonHover: 'hover:bg-emerald-900/40 hover:border-emerald-600/60',
    },
};

// ── Language Badge Colors ──
export const languageColors: Record<string, string> = {
    python: 'bg-yellow-900/50 text-yellow-300',
    go: 'bg-cyan-900/50 text-cyan-300',
    lua: 'bg-indigo-900/50 text-indigo-300',
    c: 'bg-gray-700 text-gray-300',
    godot: 'bg-blue-900/50 text-blue-300',
};

export const defaultLanguageColor = 'bg-gray-700 text-gray-300';

// ── Drag and Drop Colors ──
export const dragColors = {
    ghostBorder: 'rgb(96, 165, 250)', // blue-400
    dropIndicator: 'bg-blue-500',
    draggingCard: 'opacity-40 scale-95 border-blue-700',
};

// ── Card Colors ──
export const cardColors = {
    background: 'bg-black',
    border: 'border-white',
    hoverBorder: 'hover:border-pink-300',
    shadow: 'hover:shadow-lg hover:shadow-blue-900/20',
    titleText: 'text-white',
    titleHover: 'group-hover:text-blue-400',
    descriptionText: 'text-gray-400',
    priorityBadge: 'bg-orange-900/50 text-orange-300',
    actionButton: 'hover:bg-gray-700 text-gray-400',
    actionButtonEdit: 'hover:text-blue-500',
    actionButtonDelete: 'hover:text-red-500',
};

// ── Modal Colors ──
export const modalColors = {
    backdrop: 'bg-black/50',
    background: 'bg-gray-800',
    border: 'border-gray-700',
    borderLight: 'border-gray-700/50',
    borderGrayDark: 'border-gray-500', // for toggle button border when hidden
    toggleButtonGray: 'rgba(128,128,128,0.45)', // for toggle button overlay when hidden
    titleText: 'text-white',
    subtitleText: 'text-gray-400',
    closeButton: 'text-gray-400 hover:text-gray-300',
};

// ── Button Colors ──
export const buttonColors = {
    primary: 'bg-black hover:bg-gray-700 text-white',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-black',
    danger: 'bg-red-700 hover:bg-red-800 text-white',
};

// ── Form Colors ──
export const formColors = {
    input: 'bg-gray-900 border-gray-600 text-white',
    inputFocus: 'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
    label: 'text-gray-300',
    select: 'bg-gray-900 border-gray-600 text-white',
};

// ── Page Colors ──
export const pageColors = {
    background: 'bg-black',
    headerBackground: 'bg-gray-800',
    headerTitle: 'text-white',
    headerSubtitle: 'text-white',
    loadingSpinner: 'border-blue-600',
    errorText: 'text-red-400',
    emptyText: 'text-gray-600',
    sliderAccent: '#f9a8d4', // for slider track and button
};
