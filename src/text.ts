export interface Replace {
  start: number;
  end: number;
  text: string;
}

export class Diff {
  /** In chronological order. */
  changes: Replace[];

  constructor(...changes: Replace[]) {
    this.changes = changes;
  }

  data(): Replace[] {
    return this.changes;
  }

  static flatten(diffs: Diff[]): Diff {
    return new Diff(...diffs.flatMap((diff) => diff.changes));
  }
}

export class Doc {
  text: string;

  constructor(text: string) {
    this.text = text;
  }

  toString(): string {
    return this.text;
  }

  edit(diff: Diff): Doc {
    const doc = new Doc(this.text);
    for (const change of diff.changes) {
      doc.text =
        doc.text.slice(0, change.start) +
        change.text +
        doc.text.slice(change.end);
    }
    return doc;
  }

  equals(other: Doc): boolean {
    return this.text === other.text;
  }
}
