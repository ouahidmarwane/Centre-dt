"use client";
export function PrintButton(){return <button className="print:hidden rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white" onClick={()=>window.print()} type="button">Imprimer / Enregistrer en PDF</button>}
