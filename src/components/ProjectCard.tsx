import { Project } from '@/types';
import { languageColors, defaultLanguageColor, dragColors, cardColors } from '@/lib/theme';
import { useRef, useState } from 'react';

interface ProjectCardProps {
  project: Project;
  todoCount: number;
  isDragging: boolean;
  isFocused?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onClick: () => void;
  onDelete: () => void;
  onEdit: () => void;
  fontSizeLevel: number;
  getFontSizeClass: (baseClass: string) => string;
  touchDragDelay?: number; // Delay in ms before drag starts on touch devices (default: 200)
}

export default function ProjectCard({
  project,
  todoCount,
  isDragging,
  isFocused = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onClick,
  onDelete,
  onEdit,
  fontSizeLevel,
  getFontSizeClass,
  touchDragDelay = 100, // Default 200ms delay for mobile
}: ProjectCardProps) {
  const langKey = project.language?.toLowerCase().split(',')[0]?.trim() || '';
  const langClass = languageColors[langKey] || defaultLanguageColor;

  const touchTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const [isDragReady, setIsDragReady] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    // Clear any existing timer
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
    }

    // Start a timer for the drag delay
    touchTimer.current = setTimeout(() => {
      setIsDragReady(true);
      // Optionally add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, touchDragDelay);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;

    const touch = e.touches[0];
    const moveThreshold = 10; // pixels
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);

    // If moved too much before delay completed, cancel drag
    if ((dx > moveThreshold || dy > moveThreshold) && !isDragReady) {
      if (touchTimer.current) {
        clearTimeout(touchTimer.current);
        touchTimer.current = null;
      }
      touchStartPos.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
    touchStartPos.current = null;
    setIsDragReady(false);
  };

  return (
    <div
      draggable
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', project.id.toString());
        e.dataTransfer.effectAllowed = 'move';

        // Create a custom drag ghost with clean styling
        const dragGhost = (e.currentTarget as HTMLElement).cloneNode(true) as HTMLElement;
        dragGhost.style.position = 'absolute';
        dragGhost.style.top = '-9999px';
        dragGhost.style.left = '-9999px';
        dragGhost.style.width = (e.currentTarget as HTMLElement).offsetWidth + 'px';
        dragGhost.style.border = `2px solid ${dragColors.ghostBorder}`;
        dragGhost.style.borderRadius = '0.5rem';
        dragGhost.style.transform = 'none';
        dragGhost.style.backgroundColor = 'black';
        document.body.appendChild(dragGhost);
        e.dataTransfer.setDragImage(dragGhost, e.nativeEvent.offsetX, e.nativeEvent.offsetY);
        setTimeout(() => document.body.removeChild(dragGhost), 0);

        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => { onDragOver(e); }}
      onClick={onClick}
      className={`group relative ${cardColors.background} rounded-lg border ${cardColors.border}
        p-3 cursor-grab active:cursor-grabbing
        ${cardColors.hoverBorder}
        ${cardColors.shadow}
        hover:-translate-y-0.5
        transition-all duration-150 select-none
        ${isDragging ? dragColors.draggingCard : ''}
        ${isDragReady ? 'ring-2 ring-blue-400 ring-opacity-50' : ''}
        ${isFocused ? 'ring-2 ring-pink-400 border-pink-400' : ''}`}
    >
      {/* Card header */}
      <div className="mb-1.5">
        <h3 className={`font-semibold ${getFontSizeClass('text-sm')} text-gray-900 dark:text-white leading-snug group-hover:text-pink-500 dark:group-hover:text-pink-400 transition-colors overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent`}>
          {project.name}
        </h3>
      </div>

      {/* Description */}
      {project.description && (
        <p className={`${getFontSizeClass('text-xs')} text-gray-500 dark:text-gray-400 line-clamp-2 mb-2`}>
          {project.description}
        </p>
      )}

      {/* Footer tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {project.language && (
          <span className={`${getFontSizeClass('text-[10px]')} font-medium px-1.5 py-0.5 rounded ${langClass}`}>
            {project.language}
          </span>
        )}

        {project.priority > 0 && (
          <span className={`${getFontSizeClass('text-[10px]')} font-medium px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300`}>
            P{project.priority}
          </span>
        )}

        {todoCount > 0 && (
          <span className={`${getFontSizeClass('text-[10px]')} font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300`}>
            {todoCount} todo{todoCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
