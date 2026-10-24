/** Desktop right column: the transcript and sources for the selected chapter. */
export function DetailPanelEmpty() {
  return (
    <section
      aria-label="Transcript and sources"
      className="flex min-h-[420px] flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-line bg-surface/40 p-10 text-center"
    >
      <span aria-hidden="true" className="mb-2 inline-block size-2.5 rounded-full bg-brand" />
      <h2 className="m-0 text-[15px] font-semibold">Transcript and sources</h2>
      <p className="m-0 max-w-sm text-sm leading-[1.45] text-muted-foreground">
        Pick a chapter to read along and see every source it cites, with links back to the original.
      </p>
    </section>
  );
}
