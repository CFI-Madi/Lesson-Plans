(function(){
window.QUIZ_QUESTIONS = [
  // §61.87(b)(1) — Applicable FARs
  { q: 'What is the minimum flight visibility required for VFR flight in Class G airspace below 1,200 ft AGL during the day?', a: 1, opts: ['3 statute miles','1 statute mile','½ statute mile','5 statute miles'], ref: '14 CFR §91.155' },
  { q: 'A student pilot is NOT allowed to act as PIC of an aircraft when visibility is less than:', a: 2, opts: ['5 SM','3 SM','The minimums in their solo endorsement','1 SM'], ref: '14 CFR §61.89' },
  { q: 'Before solo flight, a student pilot must have a logbook endorsement from a CFI valid for:', a: 0, opts: ['90 days','60 days','30 days','The duration of training'], ref: '14 CFR §61.87(n)' },
  { q: 'Which document must a student pilot carry during solo flight?', a: 2, opts: ['Medical certificate only','Pilot certificate only','Student pilot certificate, medical certificate, and solo endorsements','IACRA receipt'], ref: '14 CFR §61.3' },
  // §61.87(b)(2) — Airspace / airport procedures
  { q: 'At an uncontrolled airport, the standard traffic pattern altitude for propeller aircraft is:', a: 1, opts: ['500 ft AGL','1,000 ft AGL','1,500 ft AGL','800 ft AGL'], ref: 'AIM 4-3-3' },
  { q: 'What light signal from a control tower means "cleared to land" when you are on final?', a: 2, opts: ['Flashing green','Steady red','Steady green','Alternating red and green'], ref: '14 CFR §91.125, AIM 4-3-13' },
  { q: 'Class D airspace typically extends from the surface up to:', a: 0, opts: ['2,500 ft AGL','3,000 ft AGL','4,000 ft AGL','1,200 ft AGL'], ref: '14 CFR §71, AIM 3-2-5' },
  { q: 'When approaching to land at a towered airport, you lose radio contact. You should:', a: 3, opts: ['Return to your departure airport','Land immediately on any available runway','Enter a holding pattern until you restore communications','Squawk 7600 and look for light gun signals'], ref: '14 CFR §91.125' },
  // §61.87(b)(3) — Flight characteristics of the training aircraft
  { q: 'For the aircraft profile in this app, what speed is the best rate of climb (Vy)?', a: 1, opts: ['64 kts (74 mph)','74 kts (85 mph)','85 kts (98 mph)','56 kts (64 mph)'], ref: 'Aircraft-specific data (external POH / ForeFlight)' },
  { q: 'For the aircraft profile in this app, what is the maximum flap-extended speed (Vfe)?', a: 2, opts: ['85 mph','129 mph','100 kts (115 mph)','140 mph'], ref: 'Aircraft-specific data (external POH / ForeFlight)' },
  { q: 'What does the yellow arc on the airspeed indicator represent?', a: 0, opts: ['Caution range — smooth air only','Flap operating range','Normal operating range','Prohibited range'], ref: 'FAA-H-8083-25B Chapter 8' },
  { q: 'For the aircraft profile in this app, what is maneuvering speed (Va) at maximum gross weight?', a: 1, opts: ['85 mph','129 mph (112 kts)','140 mph','171 mph'], ref: 'Aircraft-specific data (external POH / ForeFlight)' },
  // §61.87(b)(4) — Stall/spin awareness
  { q: 'The FIRST indication of an approaching stall is usually:', a: 0, opts: ['Buffet / stick shaker','Sudden nose drop','Loss of altitude','Aileron ineffectiveness'], ref: 'FAA-H-8083-25B Chapter 4' },
  { q: 'During recovery from a power-off stall, the FIRST action should be:', a: 2, opts: ['Add full power','Bank to wings level','Reduce angle of attack (push forward)','Apply rudder to stop wing drop'], ref: 'FAA-H-8083-25B Chapter 4, ACS PA.VII.C' },
  { q: 'A cross-controlled stall in the base-to-final turn is most dangerous because:', a: 3, opts: ['It occurs at high airspeed','It cannot be recovered','Ailerons become more effective','It typically occurs too close to the ground to recover'], ref: 'FAA-H-8083-25B Chapter 4' },
  { q: 'The PARE spin recovery technique stands for:', a: 1, opts: ['Power, Ailerons, Rudder, Elevator','Power idle, Ailerons neutral, Rudder opposite, Elevator forward','Pull, Advance, Roll, Exit','Pitch up, Aileron, Rudder, Exit dive'], ref: 'FAA-H-8083-25B Chapter 4' },
  // §61.87(b)(5) — Weight & balance
  { q: 'For the aircraft profile in this app, what is the maximum gross weight?', a: 0, opts: ['2,150 lbs','2,300 lbs','1,950 lbs','2,400 lbs'], ref: 'Aircraft-specific data (external POH / ForeFlight)' },
  { q: 'An aft center of gravity condition results in:', a: 2, opts: ['Improved climb performance','Reduced stall speed','Reduced longitudinal stability and higher stall speed','Lower cruise fuel burn'], ref: 'FAA-H-8083-25B Chapter 10' },
  // §61.87(b)(6) — Weather
  { q: 'A temperature-dewpoint spread of less than 4°F (2°C) indicates:', a: 1, opts: ['Good VFR conditions','High likelihood of fog or low IFR','Excellent visibility','Unstable air mass'], ref: 'FAA-H-8083-25B Chapter 12' },
  { q: 'Which cloud type is associated with thunderstorm development?', a: 3, opts: ['Stratus','Cirrus','Altostratus','Cumulonimbus'], ref: 'FAA-H-8083-25B Chapter 12' },
  // §61.87(b)(7) — Density altitude
  { q: 'Density altitude increases with:', a: 2, opts: ['Lower temperature and lower altitude','Higher pressure and lower humidity','Higher temperature, lower pressure, and higher humidity','Lower temperature and higher pressure'], ref: 'FAA-H-8083-25B Chapter 11' },
  { q: 'On a hot summer day, density altitude affects aircraft performance by:', a: 0, opts: ['Increasing takeoff roll and reducing climb rate','Reducing takeoff roll and increasing climb rate','Having no measurable effect','Increasing engine power output'], ref: 'FAA-H-8083-25B Chapter 11' },
  // §61.87(b)(8) — Collision avoidance
  { q: 'When converging at approximately the same altitude, which aircraft has right of way?', a: 2, opts: ['The faster aircraft','The aircraft on the left','The aircraft on the right','The aircraft with the higher altitude'], ref: '14 CFR §91.113' },
  { q: '"See and avoid" is limited by:', a: 1, opts: ['ADS-B coverage only','Visual limitations, blind spots, and cognitive tunneling','Only instrument approaches','ATC radar coverage'], ref: 'AIM 8-1-6' },
  // §61.87(b)(9) — Runway incursion
  { q: 'A double yellow line across a taxiway is a:', a: 0, opts: ['Runway hold-short marking — STOP and hold unless cleared','Taxiway centerline','ILS critical area boundary','Runway edge marking'], ref: 'FAA AC 150/5340-1M' },
  { q: 'If unsure of your position while taxiing at an unfamiliar airport, you should:', a: 2, opts: ['Continue slowly and look for signs','Make a 180° turn','Stop and ask ATC for progressive taxi instructions','Flash your landing light'], ref: 'AIM 4-3-18' },
  // §61.87(b)(10) — Emergency procedures
  { q: 'At engine failure immediately after takeoff, the FIRST priority is:', a: 0, opts: ['Maintain best glide speed and select a landing area straight ahead','Turn back to the runway','Attempt an engine restart','Call Mayday on 121.5'], ref: 'Aircraft-specific procedure reference (external POH / ForeFlight)' },
  { q: 'The emergency squawk code is:', a: 3, opts: ['1200','7600','7500','7700'], ref: '14 CFR §91.21' },
];

})();
