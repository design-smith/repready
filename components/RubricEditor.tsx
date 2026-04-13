'use client'

import type { RubricCategory } from '@/types'

interface RubricEditorProps {
  categories: RubricCategory[]
  onChange: (categories: RubricCategory[]) => void
}

export default function RubricEditor({ categories, onChange }: RubricEditorProps) {
  function update(index: number, field: keyof RubricCategory, value: string | number) {
    const next = categories.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    onChange(next)
  }

  function remove(index: number) {
    onChange(categories.filter((_, i) => i !== index))
  }

  function add() {
    onChange([...categories, { name: '', weight: 5, description: '' }])
  }

  return (
    <div className="space-y-3">
      {categories.map((category, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_120px_1fr_auto] gap-3 items-start rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          {/* Name */}
          <div>
            <label className="label text-xs">Category name</label>
            <input
              type="text"
              value={category.name}
              onChange={(e) => update(i, 'name', e.target.value)}
              className="input text-sm"
              placeholder="e.g. Discovery"
            />
          </div>

          {/* Weight */}
          <div>
            <label className="label text-xs">
              Weight{' '}
              <span className="font-normal text-slate-500">({category.weight})</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={category.weight}
              onChange={(e) => update(i, 'weight', parseInt(e.target.value, 10))}
              className="w-full mt-2 accent-blue-600"
            />
          </div>

          {/* Description */}
          <div>
            <label className="label text-xs">Description (optional)</label>
            <input
              type="text"
              value={category.description}
              onChange={(e) => update(i, 'description', e.target.value)}
              className="input text-sm"
              placeholder="What does a good score look like?"
            />
          </div>

          {/* Remove */}
          <div className="pt-5">
            <button
              type="button"
              onClick={() => remove(i)}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white p-1.5 text-slate-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
              aria-label="Remove category"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path
                  fillRule="evenodd"
                  d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="w-4 h-4"
        >
          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
        </svg>
        Add Category
      </button>
    </div>
  )
}
