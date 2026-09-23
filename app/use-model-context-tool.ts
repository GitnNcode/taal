'use client';

import { useEffect } from 'react';
import { MAX_BPM, MIN_BPM, TAALS, type Taal } from '@/lib/tabla';

// Lets a model-context host drive the visible practice controls.
export function useModelContextTool(
  applyPracticeConfig: (taal: Taal, bpm: number) => void,
) {
  useEffect(() => {
    type Tool = {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: object;
      execute: (input: unknown) => unknown;
    };
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'configure_tabla_practice',
            title: 'Configure tabla practice',
            description:
              'Set a taal and tempo in the visible practice controls. Stops any existing rhythm; press Start rhythm to play.',
            inputSchema: {
              type: 'object',
              properties: {
                taal: { type: 'string', enum: Object.keys(TAALS) },
                bpm: { type: 'integer', minimum: MIN_BPM, maximum: MAX_BPM },
              },
              required: ['taal', 'bpm'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input: unknown) {
              const value = input as { taal: Taal; bpm: number };
              if (
                !value ||
                !Object.hasOwn(TAALS, value.taal) ||
                !Number.isInteger(value.bpm) ||
                value.bpm < MIN_BPM ||
                value.bpm > MAX_BPM
              )
                throw new Error(
                  `Choose a supported taal and a whole-number tempo from ${MIN_BPM} to ${MAX_BPM} BPM.`,
                );
              applyPracticeConfig(value.taal, value.bpm);
              return { taal: value.taal, bpm: value.bpm, playing: false };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [applyPracticeConfig]);
}
