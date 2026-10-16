const paths={
master:'M11 3h10l2 6-3 5h-8l-3-5zm1 13h8l7 11H5zm4 1v11m-6-9-1 8m13-8 1 8',
build:'M3 14 16 3l13 11M7 13v15h18V13M3 28h26M12 28V17h8v11M9 10h14',
people:'M12 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm10 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 27V17q9-11 18 0v10M23 14q8 1 8 10v3M12 15v12',
book:'M4 6q6-3 12 0 6-3 12 0v22q-6-3-12 0-6-3-12 0zM16 6v22M7 10h5m-5 4h5m7-4h6m-6 4h6',
produce:'M3 17h26q-1 12-13 12T3 17zM4 17q9-5 24-7M9 10q5-3 7-7m1 10 6-9M1 30h30',
gate:'M2 8h28M4 6q7 3 12-3 5 6 12 3M4 12h24M8 12v18m16-18v18M4 30h8m8 0h8M12 12v5h8v-5',
outside:'M16 3a13 13 0 1 0 0 26 13 13 0 0 0 0-26zM20 11l-3 9-6 1 2-9zM16 0v5m0 22v5M0 16h5m22 0h5',
scroll:'M7 7 22 3l6 19-16 5zM7 7a4 4 0 0 0-3 5l5 14a4 4 0 0 0 7-2M22 3a4 4 0 0 1 5-2l4 10M10 13l12-4m-10 9 12-4',
gear:'M13 3h6l1 4 4 2 4-1 3 5-3 3v4l3 3-3 5-4-1-4 2-1 4h-6l-1-4-4-2-4 1-3-5 3-3v-4l-3-3 3-5 4 1 4-2zM16 12a5 5 0 1 0 0 10 5 5 0 0 0 0-10',
check:'M6 3h20v27H6zM10 17l4 4 9-10M12 3V1h8v2',
info:'M16 3a13 13 0 1 0 0 26 13 13 0 0 0 0-26zM16 14v10m0-16v2',
up:'M4 15 16 3l12 12h-8v14h-8V15z',
walk:'M19 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM17 10l-5 8-8 2M17 10l4 8 7 3M15 15l1 7-7 8m7-8 6 8',
jade:'M11 2 25 5l5 15-15 10L2 23 5 8zM11 2l4 28M5 8l20-3M2 23l28-3',
wood:'M5 16 23 3l8 8L13 28zM5 16q-6 5 1 12 5 5 9-1M9 20q-3 2 1 6M11 18l16-12',
stone:'M2 16 8 8l11-4 10 10-3 12-15 4-9-6zM8 8l3 15 18-9M11 23v7',
herb:'M16 29V13M15 20Q0 20 3 6q14 0 12 14M17 16Q29 15 28 2 16 4 17 16M16 25q13 1 15-10-11-1-15 10',
grain:'M3 17h26l-4 12H7zM3 17q13-4 26 0M8 13l1-8m5 8V2m6 11 1-10m5 10 2-7',
};
export const icon=(name)=>`<svg viewBox="0 0 34 34" aria-hidden="true"><path d="${paths[name]||paths.info}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const plantArt=`<svg viewBox="0 0 90 110" aria-hidden="true"><path d="M45 103Q30 69 51 18M47 87 23 51M45 73 68 39M43 57 31 31" fill="none" stroke="#6d8051" stroke-width="2.5"/><path d="M44 94Q6 92 7 65q29-3 37 29M45 83q36 4 40-23-27-4-40 23M38 69Q9 63 14 43q22 3 24 26M48 57q32-1 32-19-20-5-32 19" fill="#698347"/><path d="m7 65 35 28m37-32L47 81m-32-38 23 26m40-30L50 55" stroke="#b2ba78" fill="none"/><g fill="#fffaf0" stroke="#d9cbb0" stroke-width=".5"><circle cx="48" cy="19" r="7"/><circle cx="56" cy="22" r="7"/><circle cx="47" cy="28" r="7"/><circle cx="40" cy="23" r="7"/><circle cx="22" cy="43" r="5"/><circle cx="31" cy="40" r="5"/><circle cx="27" cy="49" r="5"/><circle cx="68" cy="34" r="5"/><circle cx="77" cy="33" r="5"/><circle cx="73" cy="40" r="5"/></g><g fill="#d6b568"><circle cx="48" cy="23" r="3"/><circle cx="27" cy="44" r="2"/><circle cx="72" cy="36" r="2"/></g></svg>`;
