import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Plus,
  Minus,
  Trash2,
  ClipboardList,
  Send,
  CircleDollarSign,
  FileText,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Sidebar } from "./sidebar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { submitYearlyBudget } from "@backend/server-functions/budget-fns";
import { isYearlyBudgetFormEnabled } from "@backend/server-functions/settings-fns";

const OPEX_CODES = [
  {
    value: "926-0000",
    label: "926-0000 LEASE LINE FOR IT SYSTEM (926-000/23121)",
  },
  {
    value: "916-0000",
    label: "916-0000 EQUIP. RENTAL (916-000/24501) - Photocopy machine include SST 8%",
  },
  {
    value: "918-0001",
    label: "918-0001 RENTAL - LAPTOP/PC (918-0001/24602)",
  },
  {
    value: "999-1003",
    label: "999-1003 PRINTING EXP-METER READING (999-1003/27101)",
  },
  {
    value: "992-0000",
    label: "992-0000 IT & AUDIO VISUAL - EXPENSES (992-000/27809)",
  },
  {
    value: "923-0000",
    label: "923-0000 IT & AUDIO-REPAIR & MAINTENANCE (923-000/28503)",
  },
  {
    value: "945-0000",
    label: "945-0000 PROFESSIONAL FEES (945-000/29106)",
  },
] as const;

const CAPEX_CODES = [
  { value: "200-1100", label: "200-1100 : RENOVATION" },
  { value: "200-1000", label: "200-1000 : OFFICE EQUIPMENT" },
  { value: "200-0500", label: "200-0500 : IT & AUDIO VISUAL" },
] as const;

const currentYear = new Date().getFullYear();
const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

type PriceItem = {
  id: number;
  itemName?: string;
  quantity: number;
  costPerUnit: string;
};

type OpexPayloadItem = {
  itemName: string;
  quantity: number;
  costPerUnit: number;
  amount: number;
};

type OpexEntry = {
  id: number;
  code: string;
  activity: string;
  targetMonths: string;
  objectives: string;
  justifications: string;
  remarks: string;
  items: OpexPayloadItem[];
};

type CapexEntry = {
  id: number;
  code: string;
  item: string;
  justification: string;
  targetMonths: string;
  effectIfNotApproved: string;
  alternative: string;
  remarks: string;
  items: Array<{ quantity: number; costPerUnit: number; amount: number }>;
};

function formatRm(value: number) {
  return `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function opexCodeLabel(code: string) {
  return OPEX_CODES.find((entry) => entry.value === code)?.label ?? code;
}

function itemAmount(item: PriceItem) {
  return (Number(item.costPerUnit) || 0) * item.quantity;
}

function itemsTotal(items: PriceItem[]) {
  return items.reduce((sum, item) => sum + itemAmount(item), 0);
}

function readyPriceItems(items: PriceItem[], requireItemName = false) {
  return items.filter(
    (item) =>
      item.quantity > 0 &&
      (Number(item.costPerUnit) || 0) > 0 &&
      (!requireItemName || Boolean(item.itemName?.trim())),
  );
}

function toOpexPayloadItems(items: PriceItem[]): OpexPayloadItem[] {
  return readyPriceItems(items, true).map((item) => ({
    itemName: item.itemName!.trim(),
    quantity: item.quantity,
    costPerUnit: Number(item.costPerUnit),
    amount: itemAmount(item),
  }));
}

function toPayloadItems(items: PriceItem[]) {
  return readyPriceItems(items).map((item) => ({
    quantity: item.quantity,
    costPerUnit: Number(item.costPerUnit),
    amount: itemAmount(item),
  }));
}

function FormSection({
  step,
  icon: Icon,
  title,
  description,
  children,
}: {
  step: number;
  icon: typeof Tag;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-foreground/10 bg-ivory/40 p-5 md:p-6">
      <div className="mb-5 flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-sm font-semibold shadow-sm">
          {step}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-foreground/50" />
            <h3 className="font-medium">{title}</h3>
          </div>
          <p className="mt-1 text-sm text-foreground/55">{description}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function BudgetYearField({
  id,
  value,
  onValueChange,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="rounded-2xl border-2 border-lime/40 bg-lime/10 p-5 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-lime-foreground/70 uppercase">
            Before you start
          </p>
          <Label htmlFor={id} className="mt-1 block text-base font-medium">
            Which financial year is this request for?
          </Label>
          <p className="mt-1 text-sm text-foreground/55">
            All lines you add below will be saved under this year.
          </p>
        </div>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger
            id={id}
            className="h-12 w-full rounded-xl border-lime/30 bg-background text-base font-medium sm:w-[180px]"
          >
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((year) => (
              <SelectItem key={year} value={String(year)}>
                FY {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function CostItemsTable({
  items,
  onChange,
  nextId,
  multiple = true,
}: {
  items: PriceItem[];
  onChange: (items: PriceItem[]) => void;
  nextId: { current: number };
  multiple?: boolean;
}) {
  const update = (id: number, patch: Partial<PriceItem>) => {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const total = itemsTotal(items);
  const visibleItems = multiple ? items : items.slice(0, 1);

  if (!multiple) {
    const item = visibleItems[0];
    if (!item) return null;

    return (
      <div className="rounded-xl border border-foreground/10 bg-background p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Quantity</Label>
            <div className="flex w-fit items-center gap-0.5 rounded-full border border-foreground/10 p-0.5">
              <button
                type="button"
                onClick={() =>
                  update(item.id, { quantity: Math.max(1, item.quantity - 1) })
                }
                className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-ivory"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-10 text-center text-base font-medium tabular-nums">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  update(item.id, { quantity: item.quantity + 1 })
                }
                className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-ivory"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`unit-cost-${item.id}`}>Estimate cost per unit (RM)</Label>
            <Input
              id={`unit-cost-${item.id}`}
              inputMode="decimal"
              value={item.costPerUnit}
              onChange={(e) =>
                update(item.id, {
                  costPerUnit: e.target.value.replace(/[^\d.]/g, ""),
                })
              }
              placeholder="0.00"
              className="h-11 rounded-xl tabular-nums"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-ivory/60 px-4 py-3">
          <span className="text-sm text-foreground/55">Estimated price</span>
          <span className="font-display text-lg tabular-nums">
            {formatRm(itemAmount(item))}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/10 bg-background">
      <div className="hidden grid-cols-[minmax(0,1fr)_120px_140px_100px_40px] gap-3 border-b border-foreground/10 bg-ivory/60 px-4 py-2.5 text-xs font-medium tracking-wide text-foreground/50 uppercase sm:grid">
        <span>Item name</span>
        <span className="text-center">Qty</span>
        <span>Unit cost (RM)</span>
        <span className="text-right">Line total</span>
        <span />
      </div>

      <div className="divide-y divide-foreground/8">
        {visibleItems.map((item, index) => (
          <div
            key={item.id}
            className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_120px_140px_100px_40px] sm:items-center sm:gap-3 sm:px-4 sm:py-3"
          >
            <div className="space-y-1 sm:col-span-1">
              <span className="text-xs text-foreground/50 sm:hidden">
                Item {index + 1} name
              </span>
              <Input
                value={item.itemName ?? ""}
                onChange={(e) =>
                  update(item.id, { itemName: e.target.value })
                }
                placeholder="e.g. Toner cartridge"
                className="h-10 rounded-lg"
              />
            </div>

            <div className="flex items-center justify-between gap-2 sm:justify-center">
              <span className="text-xs text-foreground/50 sm:hidden">Quantity</span>
              <div className="flex items-center gap-0.5 rounded-full border border-foreground/10 p-0.5">
                <button
                  type="button"
                  onClick={() =>
                    update(item.id, { quantity: Math.max(1, item.quantity - 1) })
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-ivory"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-8 text-center text-sm font-medium tabular-nums">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    update(item.id, { quantity: item.quantity + 1 })
                  }
                  className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-ivory"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-foreground/50 sm:hidden">Unit cost (RM)</span>
              <Input
                inputMode="decimal"
                value={item.costPerUnit}
                onChange={(e) =>
                  update(item.id, {
                    costPerUnit: e.target.value.replace(/[^\d.]/g, ""),
                  })
                }
                placeholder="0.00"
                className="h-10 rounded-lg tabular-nums"
              />
            </div>

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <span className="text-xs text-foreground/50 sm:hidden">Line total</span>
              <span className="text-sm font-semibold tabular-nums">
                {formatRm(itemAmount(item))}
              </span>
            </div>

            <div className="flex justify-end sm:justify-center">
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange(items.filter((entry) => entry.id !== item.id))
                  }
                  aria-label="Remove row"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-foreground/40 transition hover:bg-ivory hover:text-foreground"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-foreground/10 bg-ivory/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() =>
            onChange([
              ...items,
              { id: nextId.current++, itemName: "", quantity: 1, costPerUnit: "" },
            ])
          }
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/70 transition hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another item
        </button>
        <div className="flex items-center justify-between gap-4 sm:justify-end">
          <span className="text-sm text-foreground/55">Section total</span>
          <span className="font-display text-lg tabular-nums">{formatRm(total)}</span>
        </div>
      </div>
    </div>
  );
}

export function BudgetFormPage() {
  const navigate = useNavigate();
  const nextId = useRef(2);
  const [opexEntries, setOpexEntries] = useState<OpexEntry[]>([]);
  const [capexEntries, setCapexEntries] = useState<CapexEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [formEnabled, setFormEnabled] = useState(true);
  const [budgetYear, setBudgetYear] = useState(String(currentYear));

  const [opexCode, setOpexCode] = useState("");
  const [opexActivity, setOpexActivity] = useState("");
  const [opexTargetMonths, setOpexTargetMonths] = useState("");
  const [opexObjectives, setOpexObjectives] = useState("");
  const [opexJustifications, setOpexJustifications] = useState("");
  const [opexRemarks, setOpexRemarks] = useState("");
  const [opexItems, setOpexItems] = useState<PriceItem[]>([
    { id: 1, itemName: "", quantity: 1, costPerUnit: "" },
  ]);

  const [capexCode, setCapexCode] = useState("");
  const [capexItem, setCapexItem] = useState("");
  const [capexJustification, setCapexJustification] = useState("");
  const [capexTargetMonths, setCapexTargetMonths] = useState("");
  const [capexEffect, setCapexEffect] = useState("");
  const [capexAlternative, setCapexAlternative] = useState("");
  const [capexRemarks, setCapexRemarks] = useState("");
  const [capexItems, setCapexItems] = useState<PriceItem[]>([
    { id: 1, quantity: 1, costPerUnit: "" },
  ]);

  useEffect(() => {
    let active = true;
    isYearlyBudgetFormEnabled()
      .then((enabled) => {
        if (!active) return;
        setFormEnabled(enabled);
      })
      .catch(() => {
        if (active) setFormEnabled(true);
      })
      .finally(() => {
        if (active) setCheckingAccess(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const opexReadyItems = toOpexPayloadItems(opexItems);
  const capexReadyItems = toPayloadItems(capexItems);
  const opexTotal = opexEntries.reduce(
    (sum, entry) =>
      sum + entry.items.reduce((itemSum, item) => itemSum + item.amount, 0),
    0,
  );
  const capexTotal = capexEntries.reduce(
    (sum, entry) =>
      sum + entry.items.reduce((itemSum, item) => itemSum + item.amount, 0),
    0,
  );
  const grandTotal = opexTotal + capexTotal;
  const canAddOpex =
    Boolean(opexCode) &&
    Boolean(opexActivity.trim()) &&
    Boolean(opexObjectives.trim()) &&
    Boolean(opexJustifications.trim()) &&
    opexReadyItems.length > 0;
  const canAddCapex =
    Boolean(capexCode) &&
    Boolean(capexItem.trim()) &&
    Boolean(capexJustification.trim()) &&
    capexReadyItems.length > 0;

  const resetOpexForm = () => {
    setOpexCode("");
    setOpexActivity("");
    setOpexTargetMonths("");
    setOpexObjectives("");
    setOpexJustifications("");
    setOpexRemarks("");
    setOpexItems([{ id: nextId.current++, itemName: "", quantity: 1, costPerUnit: "" }]);
  };

  const resetCapexForm = () => {
    setCapexCode("");
    setCapexItem("");
    setCapexJustification("");
    setCapexTargetMonths("");
    setCapexEffect("");
    setCapexAlternative("");
    setCapexRemarks("");
    setCapexItems([{ id: nextId.current++, quantity: 1, costPerUnit: "" }]);
  };

  const addOpex = (e: FormEvent) => {
    e.preventDefault();
    if (!canAddOpex) return;
    setOpexEntries((prev) => [
      ...prev,
      {
        id: Date.now(),
        code: opexCode,
        activity: opexActivity.trim(),
        targetMonths: opexTargetMonths.trim(),
        objectives: opexObjectives.trim(),
        justifications: opexJustifications.trim(),
        remarks: opexRemarks.trim(),
        items: opexReadyItems,
      },
    ]);
    resetOpexForm();
    toast.success("OPEX line added to your request");
  };

  const addCapex = (e: FormEvent) => {
    e.preventDefault();
    if (!canAddCapex) return;
    setCapexEntries((prev) => [
      ...prev,
      {
        id: Date.now(),
        code: capexCode,
        item: capexItem.trim(),
        justification: capexJustification.trim(),
        targetMonths: capexTargetMonths.trim(),
        effectIfNotApproved: capexEffect.trim(),
        alternative: capexAlternative.trim(),
        remarks: capexRemarks.trim(),
        items: capexReadyItems.slice(0, 1),
      },
    ]);
    resetCapexForm();
    toast.success("CAPEX line added to your request");
  };

  const submit = async () => {
    if (!formEnabled) {
      toast.error(
        "Yearly budget submissions are closed. Try again when your admin reopens them.",
      );
      return;
    }
    if (opexEntries.length === 0 && capexEntries.length === 0) {
      toast.error("Add at least one OPEX or CAPEX line before submitting.");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await submitYearlyBudget({
        data: {
          budgetYear: Number(budgetYear),
          opex: opexEntries.map((entry) => ({
            code: entry.code,
            activity: entry.activity,
            targetMonths: entry.targetMonths || undefined,
            objective: entry.objectives,
            justification: entry.justifications,
            remarks: entry.remarks || undefined,
            items: entry.items.map((item) => ({
              itemName: item.itemName,
              quantity: item.quantity,
              costPerUnit: item.costPerUnit,
              budgetAmount: item.amount,
            })),
          })),
          capex: capexEntries.map((entry) => ({
            code: entry.code,
            itemName: entry.item,
            justification: entry.justification,
            targetMonths: entry.targetMonths || undefined,
            effectIfNotApproved: entry.effectIfNotApproved || undefined,
            alternative: entry.alternative || undefined,
            remarks: entry.remarks || undefined,
            items: entry.items.map((item) => ({
              quantity: item.quantity,
              costPerUnit: item.costPerUnit,
              budgetAmount: item.amount,
            })),
          })),
        },
      });

      toast.success("Yearly budget request saved", {
        description: `${result.count} item${result.count === 1 ? "" : "s"} for ${result.budgetYear} · ${formatRm(grandTotal)} total.`,
      });
      navigate({ to: "/user" });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not submit your budget. Try again.",
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden app-canvas text-foreground md:flex-row">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-6 md:p-12">
        <Link
          to="/user"
          className="inline-flex items-center gap-2 text-sm text-foreground/60 transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        <div className="mt-6">
          <h1 className="font-display text-4xl">Yearly budget request</h1>
          <p className="mt-2 max-w-xl text-sm text-foreground/60">
            Add one budget line at a time. OPEX lines can include multiple cost
            items; each CAPEX line is one item only. Save lines to the summary,
            then submit when ready.
          </p>
        </div>

        {checkingAccess ? (
          <div className="mt-8 rounded-[1.5rem] border border-dashed border-foreground/15 glass-card py-16 text-center">
            <p className="text-sm text-foreground/50">Checking access…</p>
          </div>
        ) : !formEnabled ? (
          <div className="mt-8 rounded-[1.5rem] border border-dashed border-foreground/15 glass-card py-16 text-center">
            <ClipboardList className="mx-auto h-8 w-8 text-foreground/30" />
            <p className="mt-3 text-base font-medium">Submissions are closed</p>
            <p className="mt-2 text-sm text-foreground/50">
              Yearly budget forms are turned off right now. Check back when your
              admin reopens them.
            </p>
            <Link
              to="/user"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-lime px-5 py-2.5 text-sm font-medium text-lime-foreground transition hover:brightness-95"
            >
              Back to dashboard
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="rounded-[1.5rem] glass-card p-6 md:p-8">
              <BudgetYearField
                id="budget-year"
                value={budgetYear}
                onValueChange={setBudgetYear}
              />

              <Tabs defaultValue="opex" className="mt-6">
                <TabsList className="mb-6 h-auto w-full rounded-full border border-foreground/10 bg-ivory p-1">
                  <TabsTrigger
                    value="opex"
                    className="flex-1 rounded-full px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    Operating (OPEX)
                  </TabsTrigger>
                  <TabsTrigger
                    value="capex"
                    className="flex-1 rounded-full px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    Capital (CAPEX)
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="opex" className="mt-0 space-y-5">
                  <form onSubmit={addOpex} className="space-y-5">
                    <FormSection
                      step={1}
                      icon={Tag}
                      title="What is this budget for?"
                      description="Pick the account code and name this operating expense."
                    >
                      <div className="space-y-2">
                        <Label>OPEX account code</Label>
                        <Select value={opexCode} onValueChange={setOpexCode}>
                          <SelectTrigger className="h-11 rounded-xl bg-background">
                            <SelectValue placeholder="Select code" />
                          </SelectTrigger>
                          <SelectContent>
                            {OPEX_CODES.map((entry) => (
                              <SelectItem key={entry.value} value={entry.value}>
                                {entry.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="opex-activity">
                            Activity / programme / event
                          </Label>
                          <Input
                            id="opex-activity"
                            value={opexActivity}
                            onChange={(e) => setOpexActivity(e.target.value)}
                            placeholder="e.g. Annual IT maintenance programme"
                            className="h-11 rounded-xl bg-background"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="opex-target-months">
                            Target month to spend
                          </Label>
                          <Input
                            id="opex-target-months"
                            type="month"
                            value={opexTargetMonths}
                            onChange={(e) => setOpexTargetMonths(e.target.value)}
                            className="h-11 rounded-xl bg-background"
                          />
                        </div>
                      </div>
                    </FormSection>

                    <FormSection
                      step={2}
                      icon={CircleDollarSign}
                      title="Cost breakdown"
                      description="Name each item, then enter quantity and unit cost. OPEX allows multiple items per line."
                    >
                      <CostItemsTable
                        items={opexItems}
                        onChange={setOpexItems}
                        nextId={nextId}
                        multiple
                      />
                    </FormSection>

                    <FormSection
                      step={3}
                      icon={FileText}
                      title="Why this budget is needed"
                      description="Explain the purpose and how the amount was calculated."
                    >
                      <div className="space-y-2">
                        <Label htmlFor="opex-objectives">Objectives</Label>
                        <Textarea
                          id="opex-objectives"
                          value={opexObjectives}
                          onChange={(e) => setOpexObjectives(e.target.value)}
                          placeholder="What this spending aims to achieve"
                          className="min-h-[88px] rounded-xl bg-background"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="opex-justifications">
                          Justification & calculation
                        </Label>
                        <Textarea
                          id="opex-justifications"
                          value={opexJustifications}
                          onChange={(e) => setOpexJustifications(e.target.value)}
                          placeholder="Show how the total amount was worked out"
                          className="min-h-[88px] rounded-xl bg-background"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="opex-remarks">
                          Remarks <span className="text-foreground/40">(optional)</span>
                        </Label>
                        <Input
                          id="opex-remarks"
                          value={opexRemarks}
                          onChange={(e) => setOpexRemarks(e.target.value)}
                          placeholder="Any extra notes"
                          className="h-11 rounded-xl bg-background"
                        />
                      </div>
                    </FormSection>

                    <button
                      type="submit"
                      disabled={!canAddOpex}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                      Save this OPEX line to request
                    </button>
                    {!canAddOpex && (
                      <p className="text-center text-xs text-foreground/45">
                        Fill in steps 1–3 and add at least one item with a name,
                        quantity, and unit price.
                      </p>
                    )}
                  </form>
                </TabsContent>

                <TabsContent value="capex" className="mt-0 space-y-5">
                  <form onSubmit={addCapex} className="space-y-5">
                    <FormSection
                      step={1}
                      icon={Tag}
                      title="Account & timing"
                      description="Pick the CAPEX account code and when you plan to spend."
                    >
                      <div className="space-y-2">
                        <Label>CAPEX account code</Label>
                        <Select value={capexCode} onValueChange={setCapexCode}>
                          <SelectTrigger className="h-11 rounded-xl bg-background">
                            <SelectValue placeholder="Select code" />
                          </SelectTrigger>
                          <SelectContent>
                            {CAPEX_CODES.map((entry) => (
                              <SelectItem key={entry.value} value={entry.value}>
                                {entry.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="capex-target-months">
                          Target month to spend
                        </Label>
                        <Input
                          id="capex-target-months"
                          type="month"
                          value={capexTargetMonths}
                          onChange={(e) => setCapexTargetMonths(e.target.value)}
                          className="h-11 rounded-xl bg-background"
                        />
                      </div>
                    </FormSection>

                    <FormSection
                      step={2}
                      icon={CircleDollarSign}
                      title="Item & cost"
                      description="Name the item and enter quantity and estimated unit cost. Each CAPEX line is one item only."
                    >
                      <div className="space-y-2">
                        <Label htmlFor="capex-item">Item name</Label>
                        <Input
                          id="capex-item"
                          value={capexItem}
                          onChange={(e) => setCapexItem(e.target.value)}
                          placeholder="e.g. Monitor"
                          className="h-11 rounded-xl bg-background"
                        />
                      </div>

                      <CostItemsTable
                        items={capexItems}
                        onChange={setCapexItems}
                        nextId={nextId}
                        multiple={false}
                      />
                    </FormSection>

                    <FormSection
                      step={3}
                      icon={FileText}
                      title="Supporting details"
                      description="Explain why this purchase is needed and what happens if it is not approved."
                    >
                      <div className="space-y-2">
                        <Label htmlFor="capex-justification">Justification</Label>
                        <Textarea
                          id="capex-justification"
                          value={capexJustification}
                          onChange={(e) => setCapexJustification(e.target.value)}
                          placeholder="Why this item is needed"
                          className="min-h-[88px] rounded-xl bg-background"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="capex-effect">
                          Effect if budget not approved
                        </Label>
                        <Textarea
                          id="capex-effect"
                          value={capexEffect}
                          onChange={(e) => setCapexEffect(e.target.value)}
                          placeholder="Impact if this request is rejected"
                          className="min-h-[72px] rounded-xl bg-background"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="capex-alternative">
                          More cost-effective alternative{" "}
                          <span className="text-foreground/40">(optional)</span>
                        </Label>
                        <Textarea
                          id="capex-alternative"
                          value={capexAlternative}
                          onChange={(e) => setCapexAlternative(e.target.value)}
                          placeholder="Lower-cost options considered"
                          className="min-h-[72px] rounded-xl bg-background"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="capex-remarks">
                          Remarks <span className="text-foreground/40">(optional)</span>
                        </Label>
                        <Input
                          id="capex-remarks"
                          value={capexRemarks}
                          onChange={(e) => setCapexRemarks(e.target.value)}
                          placeholder="Any extra notes"
                          className="h-11 rounded-xl bg-background"
                        />
                      </div>
                    </FormSection>

                    <button
                      type="submit"
                      disabled={!canAddCapex}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-foreground py-3 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                      Save this CAPEX line to request
                    </button>
                    {!canAddCapex && (
                      <p className="text-center text-xs text-foreground/45">
                        Fill in steps 1–3 and enter quantity and unit cost.
                      </p>
                    )}
                  </form>
                </TabsContent>
              </Tabs>
            </div>

            <div className="sticky top-8 flex h-fit flex-col self-start rounded-[1.5rem] glass-card p-6 md:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl">Saved lines</h2>
                  <p className="mt-0.5 text-xs text-foreground/50">
                    Submitting for FY {budgetYear}
                  </p>
                </div>
                <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-lime px-2 text-sm font-semibold text-lime-foreground tabular-nums">
                  {opexEntries.length + capexEntries.length}
                </span>
              </div>

              {opexEntries.length === 0 && capexEntries.length === 0 ? (
                <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-dashed border-foreground/15 py-10 text-center">
                  <ClipboardList className="h-7 w-7 text-foreground/30" />
                  <p className="max-w-[220px] text-sm text-foreground/50">
                    No lines saved yet. Complete the 3 steps on the left, then
                    click Save line.
                  </p>
                </div>
              ) : (
                <div className="mt-4 max-h-[320px] space-y-5 overflow-y-auto pr-1">
                  {opexEntries.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-foreground/40 uppercase">
                        OPEX · {opexEntries.length}
                      </p>
                      <ul className="mt-1.5 space-y-2">
                        {opexEntries.map((entry) => {
                          const lineTotal = entry.items.reduce(
                            (sum, item) => sum + item.amount,
                            0,
                          );
                          return (
                            <li
                              key={entry.id}
                              className="flex items-start gap-2 rounded-xl border border-foreground/8 bg-ivory/50 p-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {entry.activity}
                                </p>
                                <p className="mt-0.5 text-xs text-foreground/50">
                                  {entry.code} · {entry.items.length} cost row
                                  {entry.items.length === 1 ? "" : "s"} ·{" "}
                                  {formatRm(lineTotal)}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setOpexEntries((prev) =>
                                    prev.filter((row) => row.id !== entry.id),
                                  )
                                }
                                aria-label="Remove OPEX line"
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/40 transition hover:bg-background hover:text-foreground"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {capexEntries.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold tracking-wide text-foreground/40 uppercase">
                        CAPEX · {capexEntries.length}
                      </p>
                      <ul className="mt-1.5 space-y-2">
                        {capexEntries.map((entry) => {
                          const lineTotal = entry.items.reduce(
                            (sum, item) => sum + item.amount,
                            0,
                          );
                          const item = entry.items[0];
                          return (
                            <li
                              key={entry.id}
                              className="flex items-start gap-2 rounded-xl border border-foreground/8 bg-ivory/50 p-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {entry.item}
                                </p>
                                <p className="mt-0.5 text-xs text-foreground/50">
                                  {entry.code}
                                  {item
                                    ? ` · qty ${item.quantity} · ${formatRm(lineTotal)}`
                                    : ` · ${formatRm(lineTotal)}`}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setCapexEntries((prev) =>
                                    prev.filter((row) => row.id !== entry.id),
                                  )
                                }
                                aria-label="Remove CAPEX line"
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground/40 transition hover:bg-background hover:text-foreground"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 space-y-2 rounded-xl bg-ivory p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/60">OPEX</span>
                  <span className="font-medium tabular-nums">
                    {formatRm(opexTotal)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-foreground/60">CAPEX</span>
                  <span className="font-medium tabular-nums">
                    {formatRm(capexTotal)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-foreground/10 pt-2 font-display text-lg">
                  <span>Grand total</span>
                  <span className="tabular-nums">{formatRm(grandTotal)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void submit()}
                disabled={
                  submitting ||
                  (opexEntries.length === 0 && capexEntries.length === 0)
                }
                className={cn(
                  "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-lime py-3 text-sm font-medium text-lime-foreground transition hover:brightness-95 disabled:opacity-40",
                )}
              >
                <Send className="h-4 w-4" />
                {submitting ? "Submitting…" : "Submit yearly budget"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
