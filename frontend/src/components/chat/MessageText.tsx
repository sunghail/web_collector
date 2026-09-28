import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { ADDRESS_PATTERN, MENTION_PATTERN, readAddress } from '@/lib/chat';

/** Plain text with "@minji" mentions marked; mentions of the viewer stand out more. */
function WithMentions({ text, myHandle }: { text: string; myHandle?: string | null }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(MENTION_PATTERN)) {
    const at = (match.index ?? 0) + match[1].length;
    const handle = match[2].replace(/\.+$/, '');
    if (handle.length < 3) continue;
    parts.push(text.slice(last, at));
    const isMe = handle.toLowerCase() === myHandle;
    parts.push(
      <span
        key={at}
        className={`rounded px-0.5 font-medium ${isMe ? 'bg-amber-400/25 text-amber-700 dark:text-amber-300' : 'bg-primary/10 text-primary'}`}
      >
        @{handle}
      </span>
    );
    last = at + 1 + handle.length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

/** Message text with web addresses turned into links that open the page, and @mentions marked. */
export function MessageText({ text, myHandle }: { text: string; myHandle?: string | null }) {
  // With a capture group, split() puts the matched addresses at the odd positions.
  const parts = text.split(ADDRESS_PATTERN);
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 0) return <WithMentions key={index} text={part} myHandle={myHandle} />;
        const { address, trailing, href } = readAddress(part);
        if (!href) return part;
        return (
          <Fragment key={index}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="break-all text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
            >
              {address}
            </a>
            {trailing}
          </Fragment>
        );
      })}
    </>
  );
}
