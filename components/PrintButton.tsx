"use client";
export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn btn-secondary no-print">Print or save as PDF</button>
  );
}
