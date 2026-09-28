import { Fragment } from 'react';
import { ADDRESS_PATTERN, readAddress } from '@/lib/chat';

/** Message text with any web addresses in it turned into links that open the page. */
export function MessageText({ text }: { text: string }) {
  // With a capture group, split() puts the matched addresses at the odd positions.
  const parts = text.split(ADDRESS_PATTERN);
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 0) return part;
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
