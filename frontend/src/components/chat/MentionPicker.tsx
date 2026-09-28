'use client';

import type { Person } from '@/lib/chat';
import { Avatar } from '@/components/social/SocialParts';

/** Suggestions shown above the message box while typing "@…". */
export function MentionPicker({
  people,
  activeIndex,
  onPick,
  onHover,
}: {
  people: Person[];
  activeIndex: number;
  onPick: (person: Person) => void;
  onHover: (index: number) => void;
}) {
  return (
    <div
      role="listbox"
      aria-label="People to mention"
      className="absolute bottom-full left-0 z-20 mb-2 w-72 overflow-hidden rounded-xl border border-border bg-popover p-1 font-sans shadow-raised"
    >
      {people.map((person, index) => (
        <button
          key={person.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          // Keep the focus in the message box: pick on mouse down, before it would blur.
          onMouseDown={(e) => {
            e.preventDefault();
            onPick(person);
          }}
          onMouseEnter={() => onHover(index)}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left ${index === activeIndex ? 'bg-accent' : ''}`}
        >
          <Avatar {...person} size="xs" />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{person.name || `@${person.handle}`}</span>
          {person.name && <span className="shrink-0 text-xs text-muted-foreground">@{person.handle}</span>}
        </button>
      ))}
    </div>
  );
}
