'use client';

import { useMemo, useRef, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';

type MentionableProfile = {
  id: string;
  fullName: string;
  handle: string;
};

function extractMentionQuery(text: string, cursor: number) {
  const untilCursor = text.slice(0, cursor);
  const match = /(?:^|\s)@([\p{L}0-9_.-]*)$/u.exec(untilCursor);
  if (!match) return null;

  const query = match[1] ?? '';
  const atIndex = untilCursor.lastIndexOf(`@${query}`);
  if (atIndex < 0) return null;

  return { query: query.toLocaleLowerCase('es-MX'), start: atIndex, end: cursor };
}

export function CommentComposer({
  mentionableProfiles,
}: {
  mentionableProfiles: MentionableProfile[];
}) {
  const [value, setValue] = useState('');
  const [cursor, setCursor] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const mentionContext = useMemo(() => extractMentionQuery(value, cursor), [value, cursor]);

  const suggestions = useMemo(() => {
    if (!mentionContext) return [] as MentionableProfile[];
    const query = mentionContext.query;

    return mentionableProfiles
      .filter((profile) => !query || profile.handle.includes(query) || profile.fullName.toLocaleLowerCase('es-MX').includes(query))
      .slice(0, 6);
  }, [mentionContext, mentionableProfiles]);

  function selectSuggestion(profile: MentionableProfile) {
    if (!mentionContext) return;

    const nextValue = `${value.slice(0, mentionContext.start)}@${profile.handle} ${value.slice(mentionContext.end)}`;
    setValue(nextValue);

    const nextCursor = mentionContext.start + profile.handle.length + 2;
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      setCursor(nextCursor);
    });
  }

  return (
    <div className="space-y-2">
      <Textarea
        ref={textareaRef}
        name="body"
        rows={3}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setCursor(event.target.selectionStart ?? event.target.value.length);
        }}
        onClick={(event) => setCursor(event.currentTarget.selectionStart ?? value.length)}
        onKeyUp={(event) => setCursor(event.currentTarget.selectionStart ?? value.length)}
        placeholder="Escribe un comentario interno... Ejemplo: @maria revisar este caso hoy."
      />

      {mentionContext && suggestions.length > 0 ? (
        <div className="rounded-2xl border border-border bg-background p-2">
          <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sugerencias de mención</p>
          <div className="space-y-1">
            {suggestions.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-muted"
                onClick={() => selectSuggestion(profile)}
              >
                <span className="font-medium text-foreground">{profile.fullName}</span>
                <span className="text-xs text-muted-foreground">@{profile.handle}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
