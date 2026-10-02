import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Upload, X, MapPin, Calendar } from "lucide-react";
import { useCategories, useHandoverPoints, useCreateItem } from "@/hooks/use-api";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import type { ItemType, CreateItemInput } from "@/lib/types";

export const Route = createFileRoute("/report")({
  head: () => ({ meta: [{ title: "Report Item | Campus Find" }] }),
  component: ReportPage,
});

type Step = "type" | "details" | "location" | "photos" | "review";

function ReportPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  const { data: handoverPoints = [] } = useHandoverPoints();
  const { mutateAsync: createItem, isPending } = useCreateItem();

  const [step, setStep] = useState<Step>("type");
  const [type, setType] = useState<ItemType>("LOST");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [locationName, setLocationName] = useState("");
  const [handoverPointId, setHandoverPointId] = useState<string | undefined>();
  const [verificationQuestion, setVerificationQuestion] = useState("");
  const [verificationAnswer, setVerificationAnswer] = useState("");
  const [imageUrls] = useState<string[]>([]);

  if (!user) return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-display text-2xl font-semibold">Sign in first</h1>
        <p className="mt-2 text-sm text-muted-foreground">You need an account to report an item.</p>
        <Link to="/login" className="mt-4 inline-flex items-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          Sign in
        </Link>
      </div>
    </div>
  );

  const steps: Step[] = ["type", "details", "location", "photos", "review"];
  const stepIdx = steps.indexOf(step);

  async function handleSubmit(): Promise<void> {
    if (!categoryId) { toast.error("Please select a category"); return; }
    const input: CreateItemInput = {
      type,
      title: title.trim(),
      description: description.trim(),
      categoryId,
      eventDate: new Date(eventDate ?? "").toISOString(),
      ...(locationName.trim() && { locationName: locationName.trim() }),
      ...(handoverPointId && { handoverPointId }),
      ...(imageUrls.length > 0 && { imageUrls }),
      ...(type === "FOUND" && verificationQuestion.trim() && {
        verificationQuestion: verificationQuestion.trim(),
        verificationAnswer: verificationAnswer.trim(),
      }),
    };
    try {
      const item = await createItem(input);
      toast.success("Item reported successfully!");
      void navigate({ to: "/items/$itemId", params: { itemId: item.id } });
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Failed to create item");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-2xl font-semibold">Report an Item</h1>
          <span className="text-sm text-muted-foreground">Step {stepIdx + 1} of {steps.length}</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        {/* Step 1: Type */}
        {step === "type" && (
          <div>
            <h2 className="font-display text-xl font-semibold mb-6">What happened?</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["LOST", "FOUND"] as ItemType[]).map((t) => (
                <button key={t} onClick={() => setType(t)}
                  className={cn("rounded-2xl border-2 p-6 text-left transition-all",
                    type === t ? (t === "LOST" ? "border-primary bg-primary/5" : "border-success bg-success/5")
                    : "border-border hover:border-muted-foreground/40")}>
                  <div className="text-3xl mb-3">{t === "LOST" ? "😔" : "🤲"}</div>
                  <div className="font-semibold text-lg mb-1">{t === "LOST" ? "I lost something" : "I found something"}</div>
                  <div className="text-sm text-muted-foreground">
                    {t === "LOST" ? "Post a listing so the finder can reach you." : "Let the owner know you have their item."}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === "details" && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Item details</h2>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Title <span className="text-destructive">*</span></label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required
                placeholder={type === "LOST" ? "Lost: Black AirPods case" : "Found: Silver water bottle"}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Description <span className="text-destructive">*</span></label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required
                placeholder="Describe the item in detail — color, brand, any distinguishing features…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Category <span className="text-destructive">*</span></label>
              <select value={categoryId ?? ""} onChange={(e) => setCategoryId(Number(e.target.value) || undefined)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary">
                <option value="">Select category…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ""}{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium flex items-center gap-1.5"><Calendar className="size-4" />Date {type === "LOST" ? "lost" : "found"} <span className="text-destructive">*</span></label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            {type === "FOUND" && (
              <>
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium text-primary mb-3">Verification (FOUND items only)</p>
                  <p className="text-xs text-muted-foreground mb-3">Add a question only the real owner would know. This prevents fake claims.</p>
                  <div className="space-y-3">
                    <input value={verificationQuestion} onChange={(e) => setVerificationQuestion(e.target.value)}
                      placeholder="e.g. What sticker is on the case?"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
                    <input value={verificationAnswer} onChange={(e) => setVerificationAnswer(e.target.value)}
                      placeholder="Answer (never shown publicly)"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Location */}
        {step === "location" && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2"><MapPin className="size-5" />Location</h2>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Where was it {type === "LOST" ? "lost" : "found"}?</label>
              <input value={locationName} onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. Library 2nd floor, North Quad, Cafeteria…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            {type === "FOUND" && handoverPoints.length > 0 && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Handover point (where is the item now?)</label>
                <div className="space-y-2">
                  {handoverPoints.map((hp) => (
                    <button key={hp.id} onClick={() => setHandoverPointId(hp.id === handoverPointId ? undefined : hp.id)}
                      className={cn("w-full rounded-xl border p-3 text-left transition-all",
                        handoverPointId === hp.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40")}>
                      <div className="font-medium text-sm">{hp.name}</div>
                      {hp.openingHours && <div className="text-xs text-muted-foreground">{hp.openingHours}</div>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Photos (placeholder — Cloudinary upload needs API key) */}
        {step === "photos" && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2"><Upload className="size-5" />Photos</h2>
            <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
              <Upload className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Photo uploads require Cloudinary configured in the backend.</p>
              <p className="mt-1 text-xs text-muted-foreground">Skip this step and continue — photos can be added later.</p>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === "review" && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Review & submit</h2>
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              <Row label="Type" value={<span className={cn("font-semibold", type === "LOST" ? "text-primary" : "text-success")}>{type}</span>} />
              <Row label="Title" value={title} />
              <Row label="Category" value={categories.find((c) => c.id === categoryId)?.name ?? "—"} />
              <Row label="Description" value={description} />
              <Row label="Date" value={new Date(eventDate ?? "").toLocaleDateString("en-IN", { dateStyle: "long" })} />
              {locationName && <Row label="Location" value={locationName} />}
              {handoverPointId && <Row label="Kept at" value={handoverPoints.find((h) => h.id === handoverPointId)?.name ?? "—"} />}
              {verificationQuestion && <Row label="Verification Q" value={verificationQuestion} />}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex items-center justify-between gap-4">
          {stepIdx > 0 ? (
            <button onClick={() => setStep(steps[stepIdx - 1]!)}
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
              Back
            </button>
          ) : <div />}

          {step !== "review" ? (
            <button
              onClick={() => {
                if (step === "details" && (!title.trim() || !description.trim() || !categoryId)) {
                  toast.error("Please fill in all required fields");
                  return;
                }
                if (step === "details" && type === "FOUND" && (!verificationQuestion.trim() || !verificationAnswer.trim())) {
                  toast.error("FOUND items need a verification question and answer");
                  return;
                }
                setStep(steps[stepIdx + 1]!);
              }}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={() => void handleSubmit()}
              disabled={isPending}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Submit report
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3 text-sm">
      <span className="w-28 flex-shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="flex-1 text-foreground">{value || "—"}</span>
    </div>
  );
}
