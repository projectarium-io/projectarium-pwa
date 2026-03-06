'use client';

import { useState } from 'react';
import { Project, KANBAN_COLUMNS, KanbanStatus, normalizeStatus } from '@/types';

interface ProjectFormProps {
  project?: Project;
  onSubmit: (data: Partial<Project>) => Promise<void>;
  onCancel: () => void;
  fontSizeLevel?: number;
  getFontSizeClass?: (baseClass: string) => string;
}

const fieldClass =
  'w-full px-3 py-2 bg-transparent border border-white/20 rounded text-white text-sm ' +
  'placeholder-gray-600 focus:outline-none focus:border-pink-300 focus:ring-1 focus:ring-pink-300 ' +
  'transition-colors disabled:opacity-40';

const labelClass = 'block text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1';

export default function ProjectForm({
  project,
  onSubmit,
  onCancel,
  fontSizeLevel,
  getFontSizeClass,
}: ProjectFormProps) {
  const [formData, setFormData] = useState({
    name: project?.name || '',
    description: project?.description || '',
    path: project?.path || '',
    file: project?.file || '',
    language: project?.language || '',
    status: project ? normalizeStatus(project.status) : 'backlog',
    priority: project?.priority ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.path.trim()) newErrors.path = 'Path is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSubmit(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}
      className="space-y-4"
    >
      {/* Name */}
      <div>
        <label className={labelClass}>Name</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={fieldClass}
          placeholder="project-name"
          disabled={saving}
        />
        {errors.name && <p className="mt-1 text-xs text-pink-400">{errors.name}</p>}
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>Description</label>
        <input
          type="text"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          maxLength={29}
          className={fieldClass}
          placeholder="short description (max 29 chars)"
          disabled={saving}
        />
      </div>

      {/* Path + File */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Path</label>
          <input
            type="text"
            value={formData.path}
            onChange={(e) => setFormData({ ...formData, path: e.target.value })}
            className={fieldClass}
            placeholder="/home/user/code/..."
            disabled={saving}
          />
          {errors.path && <p className="mt-1 text-xs text-pink-400">{errors.path}</p>}
        </div>
        <div>
          <label className={labelClass}>File</label>
          <input
            type="text"
            value={formData.file}
            onChange={(e) => setFormData({ ...formData, file: e.target.value })}
            className={fieldClass}
            placeholder="main.py"
            disabled={saving}
          />
        </div>
      </div>

      {/* Language + Status + Priority */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Language</label>
          <input
            type="text"
            value={formData.language}
            onChange={(e) => setFormData({ ...formData, language: e.target.value })}
            className={fieldClass}
            placeholder="Python"
            disabled={saving}
          />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as KanbanStatus })}
            className={fieldClass + ' cursor-pointer'}
            disabled={saving}
          >
            {KANBAN_COLUMNS.map((col) => (
              <option key={col.key} value={col.key} className="bg-black text-white">
                {col.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Priority</label>
          <select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
            className={fieldClass + ' cursor-pointer'}
            disabled={saving}
          >
            <option value={0} className="bg-black text-white">None</option>
            <option value={1} className="bg-black text-white">Low</option>
            <option value={2} className="bg-black text-white">Medium</option>
            <option value={3} className="bg-black text-white">High</option>
          </select>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 pt-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-pink-500 hover:bg-pink-400 text-white font-semibold py-2 px-4 rounded
            transition-colors disabled:opacity-40 text-sm tracking-wider uppercase"
        >
          {saving ? 'Saving…' : project ? 'Update' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex-1 border border-white/20 hover:border-white/50 text-gray-400 hover:text-white
            font-medium py-2 px-4 rounded transition-colors text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
