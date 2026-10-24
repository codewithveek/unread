import { MakeNowButton } from "./make-now-button";

/** prd §12: "Today's episode couldn't be made: [reason]. Try again." Earlier episodes stay. */
export function FailureBanner({ message }: { message: string }) {
  const notEnough = /not enough new content/i.test(message);
  return (
    <section role="alert" className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-[18px]">
      <p className="m-0 text-[15px] font-semibold">{notEnough ? "No new episode this time" : "Today's episode couldn't be made"}</p>
      <p className="m-0 text-sm text-muted-foreground">{notEnough ? message : `Reason: ${message}.`}</p>
      {notEnough ? null : <MakeNowButton label="Try again" variant="secondary" />}
    </section>
  );
}
