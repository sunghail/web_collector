'use client';

import type { ReactNode } from 'react';
import { CornerUpLeft, SmilePlus, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MORE_REACTIONS, QUICK_REACTIONS, type Reaction } from '@/lib/chat';

const emojiItem = 'flex size-9 cursor-pointer items-center justify-center rounded-md p-0 text-xl leading-none';

/** The full emoji list behind a + button. */
function ReactionPicker({ trigger, onPick }: { trigger: ReactNode; onPick: (emoji: string) => void }) {
  const groups = [{ label: 'Quick', emojis: QUICK_REACTIONS }, ...MORE_REACTIONS];
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[248px] p-2 font-sans">
        {groups.map((group) => (
          <div key={group.label}>
            <DropdownMenuLabel className="px-1 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">{group.label}</DropdownMenuLabel>
            <div className="grid grid-cols-6 gap-0.5">
              {group.emojis.map((emoji) => (
                <DropdownMenuItem key={emoji} onSelect={() => onPick(emoji)} className={emojiItem} aria-label={`React with ${emoji}`}>
                  {emoji}
                </DropdownMenuItem>
              ))}
            </div>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const toolButton =
  'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground';

/** Floating bar shown while pointing at a message: quick reactions, the full list, reply, and delete for your own. */
export function MessageActions({
  onReact,
  onReply,
  onDelete,
}: {
  onReact: (emoji: string) => void;
  onReply?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className="
        absolute -top-4 right-2 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-0.5 font-sans shadow-raised
        opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100
      "
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          aria-label={`React with ${emoji}`}
          title={`React with ${emoji}`}
          className="flex size-7 items-center justify-center rounded-md text-base leading-none transition-transform hover:scale-125 hover:bg-accent"
        >
          {emoji}
        </button>
      ))}
      <ReactionPicker
        onPick={onReact}
        trigger={
          <button type="button" aria-label="More reactions" title="More reactions" className={toolButton}>
            <SmilePlus className="size-4" />
          </button>
        }
      />
      {onReply && (
        <>
          <span className="mx-0.5 h-4 w-px bg-border" />
          <button type="button" onClick={onReply} aria-label="Reply" title="Reply" className={toolButton}>
            <CornerUpLeft className="size-4" />
          </button>
        </>
      )}
      {onDelete && (
        <>
          <span className="mx-0.5 h-4 w-px bg-border" />
          <button type="button" onClick={onDelete} aria-label="Delete message" title="Delete" className={`${toolButton} hover:text-destructive`}>
            <Trash2 className="size-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

/** "👍 3  ❤️ 1" under a message. Click one to add or take back your own. */
export function ReactionChips({ reactions, onToggle }: { reactions: Reaction[]; onToggle: (emoji: string) => void }) {
  if (reactions.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1 font-sans">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={() => onToggle(reaction.emoji)}
          aria-pressed={reaction.mine}
          aria-label={`${reaction.emoji} ${reaction.count}, ${reaction.mine ? 'remove your reaction' : 'add your reaction'}`}
          title={`${reaction.handles.join(', ')} reacted with ${reaction.emoji}`}
          className={`
            flex h-7 items-center gap-1.5 rounded-full border px-2 text-xs tabular-nums transition-colors
            ${reaction.mine
              ? 'border-primary/60 bg-primary/10 font-semibold text-primary'
              : 'border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground'}
          `}
        >
          <span className="text-sm leading-none">{reaction.emoji}</span>
          {reaction.count}
        </button>
      ))}
      <ReactionPicker
        onPick={onToggle}
        trigger={
          <button
            type="button"
            aria-label="Add a reaction"
            title="Add a reaction"
            className="flex h-7 items-center rounded-full border border-dashed border-border px-2 text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
          >
            <SmilePlus className="size-3.5" />
          </button>
        }
      />
    </div>
  );
}
