'use client';

import { useRef } from 'react';
import { Download, FilePlus2, Upload } from 'lucide-react';
import {
  TAALS,
  parseComposition,
  type Composition,
  type Taal,
} from '@/lib/tabla';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

export default function ComposerFooter({
  composition,
  onLoadTaal,
  onNew,
  onImport,
  onNotice,
}: {
  composition: Composition;
  onLoadTaal: (taal: Taal) => void;
  onNew: () => void;
  onImport: (composition: Composition) => void;
  onNotice: (message: string) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <div className="composition-footer">
      <div className="starter-pattern">
        <span>Start from a taal</span>
        <Select
          value={null}
          onValueChange={(value) => {
            if (value && Object.hasOwn(TAALS, value)) onLoadTaal(value as Taal);
          }}
        >
          <SelectTrigger aria-label="Load a taal into the composition">
            <SelectValue placeholder="Choose a pattern" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TAALS).map(([id, pattern]) => (
              <SelectItem key={id} value={id}>
                {pattern.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="file-actions">
        <button className="text-button" onClick={onNew}>
          <FilePlus2 size={15} />
          New composition
        </button>
        <button
          className="text-button"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(composition, null, 2)], {
                type: 'application/json',
              }),
            );
            const a = document.createElement('a');
            a.href = url;
            a.download = `${composition.name.trim().replace(/[^a-z0-9_-]+/gi, '-') || 'taal-composition'}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          <Download size={15} />
          Export composition
        </button>
        <button
          className="text-button"
          onClick={() => fileInput.current?.click()}
        >
          <Upload size={15} />
          Import
        </button>
        <input
          ref={fileInput}
          hidden
          type="file"
          accept=".json,application/json"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              if (file.size > 2_000_000)
                throw new Error('Choose a composition file smaller than 2 MB.');
              onImport(parseComposition(JSON.parse(await file.text())));
            } catch (err) {
              onNotice(
                err instanceof Error
                  ? err.message
                  : 'That file could not be opened.',
              );
            }
          }}
        />
      </div>
    </div>
  );
}
