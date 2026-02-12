"use client";

import { useState, useRef, useEffect } from "react";

interface MultiSelectTagsProps {
  availableTags: string[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  onCreateTag?: (name: string) => Promise<void>;
  placeholder?: string;
}

export function MultiSelectTags({
  availableTags,
  selectedTags,
  onChange,
  onCreateTag,
  placeholder = "タグを選択...",
}: MultiSelectTagsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newTag, setNewTag] = useState("");
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // クリック外で閉じる
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = availableTags.filter((tag) =>
    tag.toLowerCase().includes(search.toLowerCase())
  );

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter((t) => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const removeTag = (tag: string) => {
    onChange(selectedTags.filter((t) => t !== tag));
  };

  const handleCreateTag = async () => {
    const name = newTag.trim();
    if (!name || !onCreateTag) return;
    setCreating(true);
    try {
      await onCreateTag(name);
      if (!selectedTags.includes(name)) {
        onChange([...selectedTags, name]);
      }
      setNewTag("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* 選択エリア */}
      <div
        className="w-full min-h-[38px] px-3 py-2 border border-gray-300 rounded-lg text-sm cursor-pointer flex flex-wrap items-center gap-1"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedTags.length === 0 && (
          <span className="text-gray-400">{placeholder}</span>
        )}
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="hover:text-blue-800"
            >
              &times;
            </button>
          </span>
        ))}
      </div>

      {/* ドロップダウン */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-hidden">
          {/* 検索 */}
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="検索..."
              className="w-full px-2 py-1 text-sm border border-gray-200 rounded"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* タグ一覧 */}
          <div className="max-h-40 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-400">
                タグが見つかりません
              </div>
            ) : (
              filtered.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <div
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 hover:bg-gray-50 ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    <span
                      className={`w-4 h-4 border rounded flex items-center justify-center text-xs ${
                        isSelected
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-gray-300"
                      }`}
                    >
                      {isSelected && "✓"}
                    </span>
                    {tag}
                  </div>
                );
              })
            )}
          </div>

          {/* 新規タグ追加 */}
          {onCreateTag && (
            <div className="p-2 border-t border-gray-100 flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="新しいタグ名"
                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreateTag();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleCreateTag}
                disabled={!newTag.trim() || creating}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                追加
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
