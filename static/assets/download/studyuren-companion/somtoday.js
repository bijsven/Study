// // ============================================
// // SOMTODAY ROOSTER INJECTOR (DESIGN 2.0)
// // ============================================

// (function() {
//     /**
//      * Configuratie van stijlen per type les
//      */
//     const STIJLEN = {
//         normaal: {
//             border: '#0066CC',
//             bg: '#1a344d',
//             text: '#fff',
//             icon: '📘'
//         }
//     };

//     function voegLesToe(dagIndex, lesData) {
//         // 1. Validatie van rooster en dag
//         const roosterWeek = document.querySelector('sl-rooster-week[data-position="center"]');
//         if (!roosterWeek) return false;

//         const roosterDagen = roosterWeek.querySelectorAll('sl-rooster-dag');
//         if (dagIndex >= roosterDagen.length) return false;
        
//         const doelDag = roosterDagen[dagIndex];

//         // 2. Check op dubbele invoer
//         const existingId = `custom-${dagIndex}-${lesData.uurNummer}`;
//         if (doelDag.querySelector(`[data-custom-id="${existingId}"]`)) return false;

//         // 3. Positie berekening
//         const HEIGHT_PER_HOUR = 66; 
//         const topMapping = {
//             1: 210, 2: 280, 3: 378, 4: 448,
//             5: 560, 6: 630, 7: 714,
//             8: 800, 9: 870
//         };

//         const type = lesData.type || 'normaal';
//         const stijl = STIJLEN[type] || STIJLEN.normaal;
//         const lesTop = topMapping[lesData.uurNummer] || 0;
//         const lesHeight = (lesData.duurUren || 1) * HEIGHT_PER_HOUR;

//         // 4. Element aanmaken
//         const lesElement = document.createElement('sl-rooster-item');
//         lesElement.setAttribute('role', 'button');
//         lesElement.setAttribute('data-custom-id', existingId);
//         lesElement.setAttribute('class', 'les ng-star-inserted custom-lesson');
        
//         // =================================================================
//         // HIER ZIT HET NIEUWE DESIGN & DE Z-INDEX FIX
//         // =================================================================
//         lesElement.style.cssText = `
//             position: absolute;
//             z-index: 2;                  /* FIX: Laag genoeg om onder menu's te blijven */
//             top: ${lesTop}px;
//             left: 2px;                   /* Klein beetje ruimte links */
//             right: 2px;                  /* Klein beetje ruimte rechts */
//             width: auto;
//             height: ${lesHeight - 4}px;  /* Iets kleiner voor margin */
//             margin-right: 15px;
            
//             background-color: ${stijl.bg};
//             border-left: 5px solid ${stijl.border};
            
//             border-radius: 6px;          /* Modernere ronde hoeken */
//             box-shadow: 0 2px 5px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.05); /* Mooie schaduw */
            
//             box-sizing: border-box;
//             cursor: pointer;
//             transition: transform 0.1s ease, box-shadow 0.1s ease;
//             overflow: hidden;
//         `;

//         // Hover effect toevoegen via JS events omdat we inline styles gebruiken
//         lesElement.onmouseenter = () => {
//             lesElement.style.transform = 'translateY(-1px)';
//             lesElement.style.boxShadow = '0 4px 8px rgba(0,0,0,0.12)';
//         };
//         lesElement.onmouseleave = () => {
//             lesElement.style.transform = 'translateY(0)';
//             lesElement.style.boxShadow = '0 2px 5px rgba(0,0,0,0.08)';
//         };

//         // 5. De Inhoud (HTML)
//         lesElement.innerHTML = `
//             <div style="
//                 padding: 8px 10px; 
//                 height: 100%; 
//                 display: flex; 
//                 flex-direction: column; 
//                 font-family: 'Open Sans', sans-serif;
//             ">
                
//                 <div style="flex: 1;">
//                     <div style="
//                         font-size: 13px; 
//                         font-weight: 700; 
//                         color: ${stijl.text};
//                         margin-bottom: 2px;
//                         display: flex;
//                         justify-content: space-between;
//                     ">
//                         <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
//                             ${lesData.titel}
//                         </span>
//                         <span style="opacity: 0.6; font-weight: normal;">${stijl.icon || ''}</span>
//                     </div>
                    
//                     <div style="
//                         font-size: 12px; 
//                         font-weight: 600; 
//                         color: #555;
//                         display: flex;
//                         align-items: center;
//                         gap: 4px;
//                     ">
//                         ${lesData.lokaal}
//                     </div>

//                     ${lesData.extra ? `
//                     <div style="
//                         font-size: 11px; 
//                         color: #666; 
//                         margin-top: 6px; 
//                         font-style: italic;
//                         line-height: 1.2;
//                         color: white;
//                     ">
//                         ${lesData.extra}
//                     </div>` : ''}
//                 </div>
//             </div>
//         `;

//         // 6. Invoegen
//         const eersteLes = doelDag.querySelector('sl-rooster-item');
//         if (eersteLes) {
//             doelDag.insertBefore(lesElement, eersteLes);
//         } else {
//             const tijdlijn = doelDag.querySelector('.tijdlijn');
//             if (tijdlijn) {
//                 doelDag.insertBefore(lesElement, tijdlijn);
//             } else {
//                 doelDag.appendChild(lesElement);
//             }
//         }
        
//         console.log(`✅ Les '${lesData.titel}' toegevoegd.`);
//         return true;
//     }

//     // --- Start Logica ---
//     function startInjectie() {
//         const lessen = [
//             {
//                 dag: 0,
//                 titel: 'Wiskunde Bijles',
//                 lokaal: 'B204',
//                 uurNummer: 1,
//                 startTijd: '12:40',
//                 type: 'bijles'
//             },
//         ];

//         lessen.forEach(les => voegLesToe(les.dag, les));
//     }

//     // --- Wacht & Execute Logica ---
//     function wachtOpRooster() {
//         const rooster = document.querySelector('sl-rooster-week[data-position="center"]');
//         if (rooster) {
//             console.log("🚀 Rooster gevonden, lessen injecteren...");
//             startInjectie();
//         } else {
//             setTimeout(wachtOpRooster, 500);
//         }
//     }

//     if (window.location.hostname.includes("somtoday.nl")) {
//         console.log("Starting Injector v2.0...");
//         wachtOpRooster();
//     }
// })();