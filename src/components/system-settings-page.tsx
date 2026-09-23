import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Search, Settings2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  listHodDepartmentStaff,
  listSystemSettings,
  updateSystemSetting,
  type DepartmentStaffMember,
  type SystemSetting,
} from "@backend/server-functions/settings-fns";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SystemSettingsPage({
  Sidebar,
  showDepartmentStaff = false,
}: {
  Sidebar: ComponentType;
  showDepartmentStaff?: boolean;
}) {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [staff, setStaff] = useState<DepartmentStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(showDepartmentStaff);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [staffQuery, setStaffQuery] = useState("");

  useEffect(() => {
    let active = true;
    listSystemSettings()
      .then((rows) => {
        if (active) setSettings(rows);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load settings. Refresh and try again.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!showDepartmentStaff) return;
    let active = true;
    listHodDepartmentStaff()
      .then((rows) => {
        if (active) setStaff(rows);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(
          error instanceof Error
            ? error.message
            : "Could not load staff list. Refresh and try again.",
        );
      })
      .finally(() => {
        if (active) setStaffLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showDepartmentStaff]);

  const filteredStaff = useMemo(() => {
    const q = staffQuery.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (row) =>
        row.email.toLowerCase().includes(q) ||
        (row.designation ?? "").toLowerCase().includes(q) ||
        row.roleName.toLowerCase().includes(q) ||
        (row.staffId != null && String(row.staffId).includes(q)),
    );
  }, [staff, staffQuery]);

  const toggleSetting = async (setting: SystemSetting) => {
    if (savingId != null) return;
    const nextEnabled = !setting.enabled;
    setSavingId(setting.id);
    setSettings((prev) =>
      prev.map((row) =>
        row.id === setting.id
          ? {
              ...row,
              enabled: nextEnabled,
              value: nextEnabled ? 1 : 0,
            }
          : row,
      ),
    );
    try {
      const updated = await updateSystemSetting({
        data: { settingId: setting.id, enabled: nextEnabled },
      });
      setSettings((prev) =>
        prev.map((row) => (row.id === updated.id ? updated : row)),
      );
      toast.success(
        nextEnabled
          ? `${setting.name} turned on`
          : `${setting.name} turned off`,
      );
    } catch (error) {
      setSettings((prev) =>
        prev.map((row) =>
          row.id === setting.id
            ? {
                ...row,
                enabled: setting.enabled,
                value: setting.enabled ? 1 : 0,
              }
            : row,
        ),
      );
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not update that setting. Try again.",
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden app-canvas text-foreground md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 md:p-12">
        <div>
          <h1 className="font-display text-4xl">Settings</h1>
          <p className="mt-2 text-sm text-foreground/60">
            {showDepartmentStaff
              ? "Manage system options and review your department staff activity."
              : "Turn system options on or off for Budget Tracker."}
          </p>
        </div>

        <section className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-lime-foreground">
              <Settings2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-2xl">System options</h2>
              <p className="text-xs text-foreground/50">
                Changes apply across Budget Tracker.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[1.5rem] border border-dashed border-foreground/15 glass-card py-16 text-center">
              <p className="text-sm text-foreground/50">Loading settings…</p>
            </div>
          ) : settings.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-foreground/15 glass-card py-16 text-center">
              <Settings2 className="mx-auto h-8 w-8 text-foreground/30" />
              <p className="mt-3 text-sm text-foreground/50">
                No settings found yet. Ask IT to add them in the database.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[1.5rem] glass-card">
              <ul className="divide-y divide-foreground/10">
                {settings.map((setting) => (
                  <li
                    key={setting.id}
                    className="flex items-center justify-between gap-4 px-6 py-5 md:px-8"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium">
                        {setting.name}
                      </p>
                      <p className="mt-1 text-sm text-foreground/50">
                        Click On/Off to change this option.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={savingId === setting.id}
                      onClick={() => void toggleSetting(setting)}
                      aria-pressed={setting.enabled}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition",
                        setting.enabled
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-foreground/10 text-foreground/60 hover:bg-foreground/15",
                        savingId === setting.id && "opacity-60",
                      )}
                    >
                      {setting.enabled ? "On" : "Off"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {showDepartmentStaff && (
          <section className="mt-10">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-lime-foreground">
                  <Users className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-2xl">Department staff</h2>
                  <p className="text-xs text-foreground/50">
                    {staffLoading
                      ? "Loading staff…"
                      : `${staff.length} staff · email and last login`}
                  </p>
                </div>
              </div>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-foreground/40" />
                <Input
                  value={staffQuery}
                  onChange={(event) => setStaffQuery(event.target.value)}
                  placeholder="Search email or staff ID"
                  className="h-10 rounded-full border-foreground/10 bg-background pl-9"
                />
              </div>
            </div>

            {staffLoading ? (
              <div className="rounded-[1.5rem] border border-dashed border-foreground/15 glass-card py-16 text-center">
                <p className="text-sm text-foreground/50">Loading staff…</p>
              </div>
            ) : staff.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-foreground/15 glass-card py-16 text-center">
                <Users className="mx-auto h-8 w-8 text-foreground/30" />
                <p className="mt-3 text-sm text-foreground/50">
                  No staff found in your department yet.
                </p>
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-foreground/15 glass-card py-16 text-center">
                <p className="text-sm text-foreground/50">
                  No staff match that search. Try another email or ID.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-[1.5rem] glass-card">
                <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-4 border-b border-foreground/10 px-6 py-3 text-xs font-medium tracking-wide text-foreground/40 uppercase md:grid md:px-8">
                  <span>Email</span>
                  <span>Role</span>
                  <span>Last login</span>
                </div>
                <ul className="divide-y divide-foreground/10">
                  {filteredStaff.map((member) => (
                    <li
                      key={member.userId}
                      className="grid gap-2 px-6 py-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)] md:items-center md:gap-4 md:px-8"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {member.email}
                        </p>
                        <p className="mt-0.5 text-xs text-foreground/50">
                          {member.staffId != null
                            ? `Staff ID ${member.staffId}`
                            : "No staff ID"}
                          {member.designation
                            ? ` · ${member.designation}`
                            : ""}
                        </p>
                      </div>
                      <div>
                        <span className="inline-flex rounded-full bg-ivory px-2.5 py-1 text-xs font-medium text-foreground/70">
                          {member.roleName}
                        </span>
                      </div>
                      <p className="text-sm tabular-nums text-foreground/70">
                        {member.lastLoginLabel}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
