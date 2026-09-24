"use client";

import { ClinicDateTimeFormat } from "@/lib/clinic-time";
import { useEffect, useRef, useState } from "react";
import type { Patient } from "@/lib/patients/data";
import type { InterventionView, Payment, FinancialSummary } from "@/lib/finance/data";
import type { DentalFinding } from "@/lib/odontogram/data";
import { conditionLabels, statusLabels } from "@/lib/odontogram/validation";

type Props = { patient: Patient; age: number | null; interventions: InterventionView[]; payments: Payment[]; summary: FinancialSummary; findings: DentalFinding[] };
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const money = (value: number) => new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const date = (value: string) => new ClinicDateTimeFormat("fr-FR").format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));

function dentalDiagram(markedTeeth: Set<number>) {
  const arch = (upper: boolean, child: boolean) => {
    const count = child ? 10 : 16;
    return Array.from({ length: count }, (_, index) => {
      const angle = Math.PI + (index + .5) * Math.PI / count;
      const x = 210 + Math.cos(angle) * (child ? 85 : 170);
      const y = (upper ? 195 : 205) + Math.sin(angle) * (upper ? (child ? 75 : 160) : -(child ? 75 : 160));
      const side = index < count / 2 ? (upper ? 1 : 4) : (upper ? 2 : 3);
      const number = index < count / 2 ? count / 2 - index : index - count / 2 + 1;
      const marked = !child && markedTeeth.has(side * 10 + number);
      const label = child ? "" : `<text x="${x + Math.cos(angle) * 24}" y="${y + Math.sin(angle) * (upper ? 24 : -24) + 4}" text-anchor="middle" font-size="11">${side}${number}</text>`;
      return `<g transform="translate(${x},${y}) rotate(${(angle * 180 / Math.PI - 270) * (upper ? 1 : -1)})"><rect x="-13" y="-14" width="26" height="28" rx="9" fill="${marked ? "#dbeafe" : "none"}" stroke="${marked ? "#102c4c" : "#333"}" stroke-width="${marked ? 2.5 : 1}"/><path d="M-8 0H8M0-9V9M-6-7L6 7M6-7L-6 7" stroke="#777" fill="none"/></g>${label}`;
    }).join("");
  };
  return `<svg viewBox="0 0 420 410" role="img" aria-label="Schéma dentaire, numérotation FDI"><g font-family="Arial" fill="#222">${arch(true, false)}${arch(false, false)}<g transform="translate(70 68) scale(.67)">${arch(true, true)}${arch(false, true)}</g><text x="210" y="90" text-anchor="middle" font-size="13">HAUT</text><text x="210" y="325" text-anchor="middle" font-size="13">BAS</text><text x="8" y="205" font-size="11">DROITE</text><text x="357" y="205" font-size="11">GAUCHE</text></g></svg>`;
}

export function buildPatientFile({ patient, age, interventions, payments, summary, findings }: Props) {
  const markedTeeth = new Set([...findings.map(item=>item.tooth_number), ...interventions.filter(item=>item.status!=="cancelled").flatMap(item=>item.teeth)]);
  const entries = [
    ...interventions.filter(item => item.status === "performed").map(item => ({ at: item.performed_at, label: `${item.nature}${item.teeth.length ? ` — dents ${item.teeth.join(", ")}` : " — dents non renseignées"}`, due: item.amount_due, received: 0 })),
    ...payments.filter(item => item.status === "received").map(item => ({ at: item.received_at, label: `Paiement${item.reference ? ` — ${item.reference}` : ""}`, due: 0, received: item.amount })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  let balance = 0;
  const rows = entries.map(item => { balance += item.due - item.received; return `<tr><td>${date(item.at)}</td><td>${escape(item.label)}</td><td>${item.due ? money(item.due) : ""}</td><td>${item.received ? money(item.received) : ""}</td><td>${money(balance)}</td></tr>`; });
  const table = (offset: number, count: number, carry: boolean) => `<div class="ledger"><table><colgroup><col><col><col><col><col></colgroup><thead><tr><th>Dates</th><th>Natures des Opérations</th><th>Prix<br>Conven.</th><th>Reçu</th><th>À<br>recevoir</th></tr></thead><tbody>${carry ? '<tr><td></td><td>Report — suite du recto</td><td colspan="3"></td></tr>' : ""}${rows.slice(offset, offset + count).join("")}${Array.from({length: Math.max(0, count - rows.slice(offset, offset + count).length)}, () => '<tr class="blank"><td></td><td></td><td></td><td></td><td></td></tr>').join("")}<tr class="total"><td></td><td>${offset + count >= rows.length ? "Total (MAD)" : "À reporter"}</td><td>${offset + count >= rows.length ? money(summary.total_due) : ""}</td><td>${offset + count >= rows.length ? money(summary.total_received) : ""}</td><td>${offset + count >= rows.length ? money(summary.outstanding) : ""}</td></tr></tbody></table></div>`;
  const question = (label: string, response = "") => `<div class="question">${label}<div class="answer">${escape(response)}</div></div>`;
  const questionnaire = `${question("Avez-vous des problèmes de Santé ?", patient.has_medical_history ? "Oui" : "Non déclaré")}${question("Lesquels ?", patient.has_medical_history ? patient.medical_history_notes ?? "" : "")}${question("Avez-vous déjà eu une anesthésie locale ?")}${question("Êtes-vous allergique aux pénicillines ou à d’autres médicaments ?", patient.has_allergies ? patient.allergy_notes ?? "Allergie déclarée (voir dossier)" : "Aucune allergie déclarée")}${question("Saignez-vous beaucoup après coupure ou piqûre ?")}${question("Êtes-vous enceinte ?")}${question("Observation", patient.general_notes ?? "")}<div class="writing-lines"></div>`;
  const pages = `<section class="sheet"><img class="file-logo" src="/images/ouahid-logo-navy.png" alt="Ouahid Dental Center" width="1774" height="887"><div class="diagram">${dentalDiagram(markedTeeth)}<p class="caption">Dents concernées (FDI) : <strong>${[...markedTeeth].sort((a,b)=>a-b).join(", ") || "aucune dent renseignée"}</strong></p></div><div><div class="identity"><div>Nom : <span>${escape(`${patient.last_name} ${patient.first_name}`)}</span></div><div class="split">Âge : <span>${age ?? ""}</span> Profession : <span>${escape(patient.profession)}</span></div><div>Adresse : <span>${escape(patient.address)}</span></div></div>${table(0, 10, false)}</div><footer>Centre Dentaire Ouahid · Dossier patient · Recto · Montants en MAD</footer></section><section class="sheet"><div class="questionnaire">${questionnaire}</div><div>${table(10, 16, true)}</div><footer>Centre Dentaire Ouahid · Dossier patient · Verso · Les réponses non enregistrées restent vides.</footer></section>${Array.from({length: Math.ceil(Math.max(0, rows.length - 26) / 20)}, (_, index) => `<section class="continuation"><h2>Suite du suivi — ${escape(`${patient.last_name} ${patient.first_name}`)}</h2>${table(26 + index * 20, 20, true)}</section>`).join("")}`;
  const clinical = findings.length ? `<h2>Constatations dentaires enregistrées</h2><ul>${findings.map(item => `<li>Dent ${item.tooth_number} : ${escape(conditionLabels[item.condition])} — ${escape(statusLabels[item.status])}${item.notes ? ` · ${escape(item.notes)}` : ""}</li>`).join("")}</ul>` : "";
  const planned = interventions.filter(item => item.status === "planned");
  const appendix = clinical || planned.length ? `<section class="continuation">${clinical}${planned.length ? `<h2>Soins planifiés (hors suivi des soins réalisés)</h2><ul>${planned.map(item => `<li>${date(item.performed_at)} · ${escape(item.nature)} · ${money(item.amount_due)} MAD</li>`).join("")}</ul>` : ""}</section>` : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Dossier patient — ${escape(patient.last_name)}</title><link rel="stylesheet" href="/patient-file.css"></head><body>${pages}${appendix}</body></html>`;
}

export function PrintablePatientFile(props: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const filename = `dossier-${props.patient.last_name.replace(/[^a-zA-Z0-9-]/g, "_")}.pdf`;
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);
  async function exportPdf() {
    const document = frame.current?.contentDocument;
    if (!document) return;
    setExporting(true);
    setExportError("");
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
      let pageCount = 0;
      for (const sheet of document.querySelectorAll<HTMLElement>(".sheet, .continuation")) {
        const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: "#ffffff", logging: false });
        const pageHeight = Math.round(canvas.width * 210 / 297);
        for (let offset = 0; offset < canvas.height - 3; offset += pageHeight) {
          if (pageCount++) pdf.addPage();
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = pageHeight;
          const context = slice.getContext("2d");
          if (!context) throw new Error("CANVAS_UNAVAILABLE");
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, slice.width, slice.height);
          context.drawImage(canvas, 0, offset, canvas.width, Math.min(pageHeight, canvas.height - offset), 0, 0, canvas.width, Math.min(pageHeight, canvas.height - offset));
          pdf.addImage(slice.toDataURL("image/jpeg", .98), "JPEG", 0, 0, 297, 210);
        }
      }
      setPdfUrl(URL.createObjectURL(pdf.output("blob")));
      pdf.save(filename);
    } catch {
      setExportError("Le PDF n’a pas pu être créé. Réessayez ou utilisez Imprimer / PDF.");
    } finally {
      setExporting(false);
    }
  }
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  return <>
    <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-[12px] bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_-8px_rgba(22,119,242,0.7)] transition-all hover:-translate-y-px hover:bg-[var(--brand-strong)] active:translate-y-0 active:scale-[0.98]" onClick={() => { setOpen(true); dialog.current?.showModal(); }}>Dossier imprimable</button>
    <dialog ref={dialog} onClose={() => { setOpen(false); setLoaded(false); }} className="m-auto h-[90dvh] w-[min(1200px,95vw)] max-w-none overflow-hidden rounded-2xl border-0 bg-slate-100 p-0 shadow-xl backdrop:bg-slate-900/60 open:flex open:flex-col" aria-labelledby="print-file-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white p-4"><div><h2 id="print-file-title" className="font-bold text-[var(--navy)]">Dossier physique · Recto / Verso</h2><p className="mt-1 text-xs text-slate-600">Format A4 paysage · prêt à imprimer sur les deux faces.</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={!loaded || exporting} className="min-h-11 rounded-md bg-[var(--brand)] px-4 text-sm font-semibold text-white disabled:opacity-50" onClick={exportPdf}>{exporting ? "Création du PDF…" : "Télécharger PDF"}</button><button type="button" disabled={!loaded} className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-50" onClick={() => { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }}>Imprimer / PDF</button><button autoFocus type="button" className="min-h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700" onClick={() => dialog.current?.close()}>Fermer</button></div></div>
      {exportError ? <p role="alert" className="bg-red-50 px-4 py-2 text-sm text-red-700">{exportError}</p> : null}
      {pdfUrl ? <p role="status" className="bg-blue-50 px-4 py-2 text-sm text-[var(--navy)]">PDF prêt. <a href={pdfUrl} download={filename} className="font-semibold underline underline-offset-4">Enregistrer le PDF</a></p> : null}
      {open ? <iframe ref={frame} title="Aperçu du dossier patient imprimable" className="min-h-0 w-full flex-1 border-0" srcDoc={buildPatientFile(props)} onLoad={() => setLoaded(true)} /> : null}
    </dialog>
  </>;
}



