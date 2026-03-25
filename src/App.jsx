import React, { useEffect, useMemo, useState } from "react";
import {
  Trash2,
  Plus,
  Download,
  Calculator,
  Hammer,
  Copy,
  RotateCcw,
  Files,
} from "lucide-react";
import jsPDF from "jspdf";

const dayOptions = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const STORAGE_KEY = "uren-app-eazy-v6";

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const number = new Intl.NumberFormat("nl-NL", {
  maximumFractionDigits: 2,
});

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyEntry() {
  return {
    id: makeId(),
    dag: "Ma",
    datum: "",
    plaats: "",
    projectnummers: "",
    uren: "",
    reisuren: "",
    kms: "",
    veerpondAantal: "",
    materiaal: "",
    notitie: "",
  };
}

const starterWeeks = {
  "Week 1": [emptyEntry()],
};

const defaultRates = {
  werkUur: 40,
  reisUur: 15,
  km: 0.23,
  veerpond: 3.5,
};

function toNum(value) {
  const str = String(value ?? "").trim();
  if (!str) return 0;

  if (str.includes(",")) {
    const cleaned = str
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^0-9.-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const cleaned = str.replace(/[^0-9.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function calculateEntry(entry, rates) {
  const uren = toNum(entry.uren);
  const reisuren = toNum(entry.reisuren);
  const kms = toNum(entry.kms);
  const veerpondAantal = toNum(entry.veerpondAantal);
  const materiaal = toNum(entry.materiaal);

  const loonUren = uren * toNum(rates.werkUur);
  const loonReisuren = reisuren * toNum(rates.reisUur);
  const kmVergoeding = kms * toNum(rates.km);
  const veerpondKosten = veerpondAantal * toNum(rates.veerpond);
  const totaal =
    loonUren + loonReisuren + kmVergoeding + veerpondKosten + materiaal;

  return {
    loonUren,
    loonReisuren,
    kmVergoeding,
    veerpondKosten,
    totaal,
  };
}

function weekSummary(entries, rates) {
  return entries.reduce(
    (acc, entry) => {
      const calc = calculateEntry(entry, rates);
      acc.uren += toNum(entry.uren);
      acc.reisuren += toNum(entry.reisuren);
      acc.kms += toNum(entry.kms);
      acc.veerpondAantal += toNum(entry.veerpondAantal);
      acc.materiaal += toNum(entry.materiaal);
      acc.loonUren += calc.loonUren;
      acc.loonReisuren += calc.loonReisuren;
      acc.kmVergoeding += calc.kmVergoeding;
      acc.veerpondKosten += calc.veerpondKosten;
      acc.totaal += calc.totaal;
      return acc;
    },
    {
      uren: 0,
      reisuren: 0,
      kms: 0,
      veerpondAantal: 0,
      materiaal: 0,
      loonUren: 0,
      loonReisuren: 0,
      kmVergoeding: 0,
      veerpondKosten: 0,
      totaal: 0,
    }
  );
}

function isBrowser() {
  return typeof window !== "undefined";
}

function forceDownloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 2000);
}

async function shareOrDownloadBlob(blob, filename, mimeType, setStatusMessage) {
  try {
    const file = new File([blob], filename, { type: mimeType });

    if (
      navigator.share &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        files: [file],
        title: filename,
        text: filename,
      });
      setStatusMessage("Bestand gedeeld");
      return;
    }

    forceDownloadBlob(blob, filename);
    setStatusMessage("Bestand gedownload");
  } catch (error) {
    console.error(error);
    try {
      forceDownloadBlob(blob, filename);
      setStatusMessage("Bestand gedownload");
    } catch (downloadError) {
      console.error(downloadError);
      setStatusMessage("Export mislukt");
    }
  }
}

async function downloadCsv(filename, text, setStatusMessage) {
  try {
    const blob = new Blob([text], {
      type: "text/csv;charset=utf-8;",
    });

    await shareOrDownloadBlob(
      blob,
      filename,
      "text/csv;charset=utf-8;",
      setStatusMessage
    );
  } catch (error) {
    console.error(error);
    setStatusMessage("CSV export mislukt");
  }
}

async function exportWeekPdf(
  weekName,
  entries,
  rates,
  summary,
  setStatusMessage
) {
  try {
    const pdf = new jsPDF();
    const pageHeight = pdf.internal.pageSize.height;
    let y = 14;

    const addLine = (text, size = 10) => {
      pdf.setFontSize(size);
      const lines = pdf.splitTextToSize(text, 180);

      lines.forEach((line) => {
        if (y > pageHeight - 14) {
          pdf.addPage();
          y = 14;
        }
        pdf.text(line, 12, y);
        y += 6;
      });
    };

    addLine(`Uren app eazy - ${weekName}`, 16);
    y += 4;

    entries.forEach((entry, i) => {
      const calc = calculateEntry(entry, rates);

      const uren = toNum(entry.uren);
      const reisuren = toNum(entry.reisuren);
      const kms = toNum(entry.kms);
      const veerpondAantal = toNum(entry.veerpondAantal);
      const materiaal = toNum(entry.materiaal);

      addLine(
        `${i + 1}. ${entry.dag} ${entry.datum || ""} | Plaats: ${
          entry.plaats || "-"
        } | Project: ${entry.projectnummers || "-"}`
      );

      addLine(
        `   Werkuren: ${number.format(uren)} x ${euro.format(
          toNum(rates.werkUur)
        )} = ${euro.format(calc.loonUren)}`
      );

      addLine(
        `   Reisuren: ${number.format(reisuren)} x ${euro.format(
          toNum(rates.reisUur)
        )} = ${euro.format(calc.loonReisuren)}`
      );

      addLine(
        `   KM: ${number.format(kms)} x ${euro.format(
          toNum(rates.km)
        )} = ${euro.format(calc.kmVergoeding)}`
      );

      addLine(
        `   Veerpond: ${number.format(veerpondAantal)} x ${euro.format(
          toNum(rates.veerpond)
        )} = ${euro.format(calc.veerpondKosten)}`
      );

      addLine(`   Materiaal: ${euro.format(materiaal)}`);

      if (entry.notitie) {
        addLine(`   Notitie: ${entry.notitie}`);
      }

      y += 2;
    });

    y += 4;
    addLine(`Weektotaal: ${euro.format(summary.totaal)}`, 12);
    addLine(`Totaal uren: ${number.format(summary.uren)}`, 12);
    addLine(`Totaal reisuren: ${number.format(summary.reisuren)}`, 12);
    addLine(`Totaal km: ${number.format(summary.kms)}`, 12);

    const blob = pdf.output("blob");
    await shareOrDownloadBlob(
      blob,
      `${weekName}.pdf`,
      "application/pdf",
      setStatusMessage
    );
  } catch (error) {
    console.error(error);
    setStatusMessage("PDF export mislukt");
  }
}

export default function App() {
  const [statusMessage, setStatusMessage] = useState("");

  const [rates, setRates] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return saved?.rates || defaultRates;
    } catch {
      return defaultRates;
    }
  });

  const [weeks, setWeeks] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return saved?.weeks || starterWeeks;
    } catch {
      return starterWeeks;
    }
  });

  const [activeWeek, setActiveWeek] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return saved?.activeWeek || "Week 1";
    } catch {
      return "Week 1";
    }
  });

  const [newWeek, setNewWeek] = useState("2");

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ rates, weeks, activeWeek })
    );
  }, [rates, weeks, activeWeek]);

  useEffect(() => {
    if (!statusMessage) return;
    const t = setTimeout(() => setStatusMessage(""), 3000);
    return () => clearTimeout(t);
  }, [statusMessage]);

  const orderedWeekNames = useMemo(() => {
    return Object.keys(weeks).sort((a, b) => {
      const aNum = toNum(a.replace(/[^0-9]/g, ""));
      const bNum = toNum(b.replace(/[^0-9]/g, ""));
      return aNum - bNum;
    });
  }, [weeks]);

  const summaries = useMemo(() => {
    return Object.fromEntries(
      Object.entries(weeks).map(([weekName, entries]) => [
        weekName,
        weekSummary(entries, rates),
      ])
    );
  }, [weeks, rates]);

  const grandTotal = useMemo(() => {
    const values = Object.values(summaries);
    const total = values.reduce(
      (acc, s) => {
        acc.weken += 1;
        acc.uren += s.uren;
        acc.reisuren += s.reisuren;
        acc.kms += s.kms;
        acc.veerpondAantal += s.veerpondAantal;
        acc.materiaal += s.materiaal;
        acc.totaal += s.totaal;
        return acc;
      },
      {
        weken: 0,
        uren: 0,
        reisuren: 0,
        kms: 0,
        veerpondAantal: 0,
        materiaal: 0,
        totaal: 0,
      }
    );

    return {
      ...total,
      gemiddeldePerWeek: total.weken ? total.totaal / total.weken : 0,
    };
  }, [summaries]);

  const updateRate = (key, value) => {
    setRates((prev) => ({ ...prev, [key]: value }));
  };

  const addWeek = () => {
    const nr = String(newWeek).trim();
    if (!nr) return;

    const cleanNr = nr.replace(/[^0-9]/g, "");
    if (!cleanNr) return;

    const name = `Week ${cleanNr}`;
    if (weeks[name]) {
      setActiveWeek(name);
      setStatusMessage("Week bestaat al en is geopend");
      return;
    }

    setWeeks((prev) => ({ ...prev, [name]: [emptyEntry()] }));
    setActiveWeek(name);
    setNewWeek(String(Number(cleanNr) + 1));
    setStatusMessage("Week toegevoegd");
  };

  const deleteWeek = (weekName) => {
    const names = Object.keys(weeks);
    if (names.length === 1) {
      setStatusMessage("Je moet minimaal 1 week houden");
      return;
    }

    const next = { ...weeks };
    delete next[weekName];
    setWeeks(next);

    if (activeWeek === weekName) {
      const ordered = Object.keys(next).sort((a, b) => {
        const aNum = toNum(a.replace(/[^0-9]/g, ""));
        const bNum = toNum(b.replace(/[^0-9]/g, ""));
        return aNum - bNum;
      });
      setActiveWeek(ordered[0] || "");
    }

    setStatusMessage("Week verwijderd");
  };

  const addEntry = (weekName) => {
    setWeeks((prev) => ({
      ...prev,
      [weekName]: [...prev[weekName], emptyEntry()],
    }));
  };

  const duplicateEntry = (weekName, entry) => {
    setWeeks((prev) => ({
      ...prev,
      [weekName]: [...prev[weekName], { ...entry, id: makeId() }],
    }));
    setStatusMessage("Regel gedupliceerd");
  };

  const updateEntry = (weekName, id, field, value) => {
    setWeeks((prev) => ({
      ...prev,
      [weekName]: prev[weekName].map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      ),
    }));
  };

  const deleteEntry = (weekName, id) => {
    setWeeks((prev) => {
      const filtered = prev[weekName].filter((entry) => entry.id !== id);
      return {
        ...prev,
        [weekName]: filtered.length ? filtered : [emptyEntry()],
      };
    });
    setStatusMessage("Regel verwijderd");
  };

  const copyPreviousWeek = (weekName) => {
    const nr = Number(weekName.replace(/[^0-9]/g, ""));
    const prev = `Week ${nr - 1}`;
    if (!weeks[prev]) {
      setStatusMessage("Vorige week niet gevonden");
      return;
    }

    setWeeks((p) => ({
      ...p,
      [weekName]: p[prev].map((e) => ({ ...e, id: makeId() })),
    }));
    setStatusMessage("Vorige week gekopieerd");
  };

  const resetAll = () => {
    const confirmed = window.confirm("Weet je zeker dat je alles wilt wissen?");
    if (!confirmed) return;

    setRates(defaultRates);
    setWeeks(starterWeeks);
    setActiveWeek("Week 1");
    setNewWeek("2");
    localStorage.removeItem(STORAGE_KEY);
    setStatusMessage("Alles is gereset");
  };

  const exportSummary = async () => {
    const rows = [
      ["Week", "Uren", "Reisuren", "KM", "Veerpond x", "Materiaal", "Totaal"],
      ...orderedWeekNames.map((week) => {
        const s = summaries[week];
        return [
          week,
          number.format(s.uren),
          number.format(s.reisuren),
          number.format(s.kms),
          number.format(s.veerpondAantal),
          number.format(s.materiaal),
          s.totaal.toFixed(2),
        ];
      }),
      [
        "Gemiddelde per week",
        "",
        "",
        "",
        "",
        "",
        grandTotal.gemiddeldePerWeek.toFixed(2),
      ],
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
      )
      .join("\n");

    await downloadCsv("samenvatting-uren.csv", csv, setStatusMessage);
  };

  const card = {
    background: "white",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
    border: "1px solid #e5e7eb",
  };

  const input = {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "10px 12px",
    fontSize: 14,
    boxSizing: "border-box",
  };

  const btn = {
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    padding: "10px 14px",
    background: "white",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontWeight: 600,
  };

  const primaryBtn = {
    ...btn,
    background: "#0f172a",
    color: "white",
    borderColor: "#0f172a",
  };

  const activeEntries = weeks[activeWeek] || [];
  const activeSummary = summaries[activeWeek] || weekSummary([], rates);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 16,
        fontFamily: "Arial, sans-serif",
      }}
    >
      {statusMessage ? (
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto 12px",
            background: "#dcfce7",
            color: "#166534",
            border: "1px solid #bbf7d0",
            borderRadius: 14,
            padding: "12px 14px",
            fontWeight: 600,
          }}
        >
          {statusMessage}
        </div>
      ) : null}

      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: "#0f172a",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Hammer size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0 }}>Uren app eazy</h1>
              <div style={{ color: "#64748b", marginTop: 4 }}>
                Uren, reisuren, km, materiaal en weekoverzichten
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
          }}
        >
          <div style={card}>
            <h2>Tarieven</h2>
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
              }}
            >
              <div>
                <div>Werkuur</div>
                <input
                  type="number"
                  step="0.01"
                  style={input}
                  value={rates.werkUur}
                  onChange={(e) => updateRate("werkUur", e.target.value)}
                />
              </div>
              <div>
                <div>Reisuur</div>
                <input
                  type="number"
                  step="0.01"
                  style={input}
                  value={rates.reisUur}
                  onChange={(e) => updateRate("reisUur", e.target.value)}
                />
              </div>
              <div>
                <div>KM</div>
                <input
                  type="number"
                  step="0.01"
                  style={input}
                  value={rates.km}
                  onChange={(e) => updateRate("km", e.target.value)}
                />
              </div>
              <div>
                <div>Veerpond</div>
                <input
                  type="number"
                  step="0.01"
                  style={input}
                  value={rates.veerpond}
                  onChange={(e) => updateRate("veerpond", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={card}>
            <h2 style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Calculator size={18} /> Samenvatting
            </h2>
            <div style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  background: "#f1f5f9",
                  padding: 12,
                  borderRadius: 14,
                }}
              >
                <span>Totaal bedrag</span>
                <strong>{euro.format(grandTotal.totaal)}</strong>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  background: "#f1f5f9",
                  padding: 12,
                  borderRadius: 14,
                }}
              >
                <span>Gemiddelde per week</span>
                <strong>{euro.format(grandTotal.gemiddeldePerWeek)}</strong>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  background: "#f1f5f9",
                  padding: 12,
                  borderRadius: 14,
                }}
              >
                <span>Totaal uren</span>
                <strong>{number.format(grandTotal.uren)}</strong>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  background: "#f1f5f9",
                  padding: 12,
                  borderRadius: 14,
                }}
              >
                <span>Totaal km</span>
                <strong>{number.format(grandTotal.kms)}</strong>
              </div>
              <button style={btn} onClick={exportSummary}>
                <Download size={16} /> Exporteer samenvatting
              </button>
            </div>
          </div>
        </div>

        <div style={card}>
          <h2>Nieuwe week</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="number"
              min="1"
              style={{ ...input, maxWidth: 180 }}
              value={newWeek}
              onChange={(e) => setNewWeek(e.target.value)}
            />
            <button style={primaryBtn} onClick={addWeek}>
              <Plus size={16} /> Voeg toe
            </button>
            <button style={btn} onClick={resetAll}>
              <RotateCcw size={16} /> Reset alles
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          {orderedWeekNames.map((weekName) => (
            <button
              key={weekName}
              onClick={() => setActiveWeek(weekName)}
              style={{
                ...btn,
                background: activeWeek === weekName ? "#0f172a" : "white",
                color: activeWeek === weekName ? "white" : "black",
                borderColor: activeWeek === weekName ? "#0f172a" : "#cbd5e1",
                whiteSpace: "nowrap",
              }}
            >
              {weekName}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <h2 style={{ margin: 0 }}>{activeWeek}</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  style={btn}
                  onClick={() =>
                    exportWeekPdf(
                      activeWeek,
                      activeEntries,
                      rates,
                      activeSummary,
                      setStatusMessage
                    )
                  }
                >
                  <Download size={16} /> PDF
                </button>
                <button style={btn} onClick={() => copyPreviousWeek(activeWeek)}>
                  <Copy size={16} /> Kopieer vorige week
                </button>
                <button style={btn} onClick={() => addEntry(activeWeek)}>
                  <Plus size={16} /> Regel
                </button>
                <button style={btn} onClick={() => deleteWeek(activeWeek)}>
                  <Trash2 size={16} /> Week verwijderen
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              {activeEntries.map((entry) => {
                const calc = calculateEntry(entry, rates);

                return (
                  <div
                    key={entry.id}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 18,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))",
                      }}
                    >
                      <div>
                        <div>Dag</div>
                        <select
                          style={input}
                          value={entry.dag}
                          onChange={(e) =>
                            updateEntry(activeWeek, entry.id, "dag", e.target.value)
                          }
                        >
                          {dayOptions.map((day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div>Datum</div>
                        <input
                          type="date"
                          style={input}
                          value={entry.datum}
                          onChange={(e) =>
                            updateEntry(activeWeek, entry.id, "datum", e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <div>Plaats</div>
                        <input
                          style={input}
                          value={entry.plaats}
                          onChange={(e) =>
                            updateEntry(activeWeek, entry.id, "plaats", e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <div>Projectnummers</div>
                        <input
                          style={input}
                          value={entry.projectnummers}
                          onChange={(e) =>
                            updateEntry(
                              activeWeek,
                              entry.id,
                              "projectnummers",
                              e.target.value
                            )
                          }
                        />
                      </div>

                      <div>
                        <div>Uren</div>
                        <input
                          type="number"
                          step="0.01"
                          style={input}
                          value={entry.uren}
                          onChange={(e) =>
                            updateEntry(activeWeek, entry.id, "uren", e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <div>Reisuren</div>
                        <input
                          type="number"
                          step="0.01"
                          style={input}
                          value={entry.reisuren}
                          onChange={(e) =>
                            updateEntry(activeWeek, entry.id, "reisuren", e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <div>KM</div>
                        <input
                          type="number"
                          step="0.01"
                          style={input}
                          value={entry.kms}
                          onChange={(e) =>
                            updateEntry(activeWeek, entry.id, "kms", e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <div>Veerpond x</div>
                        <input
                          type="number"
                          step="1"
                          style={input}
                          value={entry.veerpondAantal}
                          onChange={(e) =>
                            updateEntry(
                              activeWeek,
                              entry.id,
                              "veerpondAantal",
                              e.target.value
                            )
                          }
                        />
                      </div>

                      <div>
                        <div>Materiaal</div>
                        <input
                          type="number"
                          step="0.01"
                          style={input}
                          value={entry.materiaal}
                          onChange={(e) =>
                            updateEntry(activeWeek, entry.id, "materiaal", e.target.value)
                          }
                        />
                      </div>

                      <div>
                        <div>Notitie</div>
                        <input
                          style={input}
                          value={entry.notitie}
                          onChange={(e) =>
                            updateEntry(activeWeek, entry.id, "notitie", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <strong>{euro.format(calc.totaal)}</strong>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          style={btn}
                          onClick={() => duplicateEntry(activeWeek, entry)}
                        >
                          <Files size={16} /> Dupliceer regel
                        </button>
                        <button
                          style={btn}
                          onClick={() => deleteEntry(activeWeek, entry.id)}
                        >
                          <Trash2 size={16} /> Verwijder regel
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
            }}
          >
            {[
              ["Uren", number.format(activeSummary.uren)],
              ["Reisuren", number.format(activeSummary.reisuren)],
              ["KM", number.format(activeSummary.kms)],
              ["Materiaal", euro.format(activeSummary.materiaal)],
              ["Weektotaal", euro.format(activeSummary.totaal)],
            ].map(([label, value]) => (
              <div key={label} style={card}>
                <div style={{ color: "#64748b", marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <h2>Overzicht alle weken</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {orderedWeekNames.map((weekName) => {
              const summary = summaries[weekName];
              return (
                <div
                  key={weekName}
                  style={{
                    background: "#f8fafc",
                    borderRadius: 16,
                    padding: 14,
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <strong>{weekName}</strong>
                  <span>Uren: {number.format(summary.uren)}</span>
                  <span>Reisuren: {number.format(summary.reisuren)}</span>
                  <span>KM: {number.format(summary.kms)}</span>
                  <span>Veerpond x: {number.format(summary.veerpondAantal)}</span>
                  <span>Materiaal: {euro.format(summary.materiaal)}</span>
                  <span>Totaal: {euro.format(summary.totaal)}</span>
                </div>
              );
            })}

            <div style={{ background: "#dbeafe", borderRadius: 16, padding: 14 }}>
              <strong>
                Gemiddeld per week: {euro.format(grandTotal.gemiddeldePerWeek)}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}