(() => {
  'use strict';
  const LABEL = "Sota Kece";
  const APP = "sotakece";
  let activeUser = null;
  const invitation = ["You’re welcome to listen for a while, or say your first bula whenever it feels right.", "O rawa ni vakarorogo mada, se kaya na nomu imatai ni bula ni o sa vakarau.", "Aap chaahe to kuch der suniye, ya jab man kare pahila bula kahiye."];
  const greetingCopy = {
    en: ['Bula vinaka! Welcome to ', 'We’re glad you’re here. Make yourself at home.', 'Choose your language', 'Try the demo', 'Keep exploring', 'If you need a hand, you can leave Volau a message when her message box is available.', 'Good to see you again.', 'You’re signed out on this device. Come back whenever you like.', 'Ready to sign out?', 'Stay here', 'Sign out', 'A quick look'],
    fj: ['Bula vinaka! Ni sa bula mai ena ', 'Keitou marau ni o sa mai tomani keitou. Ni vakacegu mada.', 'Digitaka na nomu vosa', 'Tovolea na demo', 'Tomana na veisiko', 'Ke o gadreva na veivuke, vola vei Volau ni sa vakarautaki na nona kato ni itukutuku.', 'Keitou marau ni o lesu mai.', 'O sa curu tani ena misini oqo. Lesu mai ena gauna o vinakata.', 'O sa vakarau mo curu tani?', 'Tiko ga', 'Curu tani', 'Raica mada'],
    hif: ['Bula vinaka! Swaagat hai — ', 'Aap ke hiyan dekh ke khusi hai. Aaraam se rahiye.', 'Apan bhaasa chuniye', 'Demo dekhiye', 'Aage dekhiye', 'Madad chaahi to jab Volau ke message box chaalu hoi, usme sandes chhori sakte hain.', 'Aap ke fir se dekh ke khusi hai.', 'Aap ii device se sign out hoi gaye. Jab man kare, fir aaiye.', 'Sign out kare ke taiyaar hain?', 'Hiyan rahiye', 'Sign out kariye', 'Ek jhalak']
  };
  function greetingLanguage() {
    let code;
    try { code = localStorage.getItem('dimau.greeting.language'); } catch (_) {}
    return Object.prototype.hasOwnProperty.call(greetingCopy, code) ? code : 'en';
  }
  function greetingElement(tag, value) {
    const element = document.createElement(tag);
    element.textContent = value;
    return element;
  }
  const returnVisitCounters = new Map();
  function nextDepartureMessage(language, accountKey, saved) {
    const lines = {
      en: [
        'Logged out. Off to pretend that you did some hard work and need a break. 🌿',
        saved ? 'Session closed. Your work is saved; your excuses are getting better. 🚶' : 'Session closed. Your excuses are getting better. 🚶',
        'Signed out. The server is going to lie down and recover for a bit. 🛌',
        'Logging off. Whatever you just did, we all saw it. 🤐',
        'Session ended. Go forth and ignore important things elsewhere. 👀',
        'Out for now. Don’t worry, we didn’t complain while we did all the work for you. 🔋',
        'Logged out. You’re free—until you start getting bored and nosey again. 🔔',
        'Session closed. Go drink some water. I never said grog or beer. 💧'
      ],
      fj: [
        'O sa curu tani. Lako mada mo vakaraitaka ni o sa cakacaka vakaukauwa ka gadreva na vakacegu. 🌿',
        'Sa oti. Sa qai maqosa tiko ga na nomu iulubale. 🚶',
        'O sa curu tani. Ena davo mada na seva me vakacegu. 🛌',
        'O sa curu tani. Na ka ga o a cakava, keitou sa raica kece. 🤐',
        'Sa oti. Lako mada mo lecava na veika bibi ena dua tale na vanua. 👀',
        'Moce mada. Keitou sega ni kudru ena gauna keitou cakava kina na nomu cakacaka. 🔋',
        'O sa curu tani. O sa galala—me yacova ni o sa via kila ka tale. 🔔',
        'Sa oti. Lako mo gunu wai. Au sega ni kaya na yaqona se bia. 💧'
      ],
      hif: [
        'Aap sign out hoi gaye. Ab aise kariye jaise bahut mehnat kare ke baad chhutti chaahi. 🌿',
        'Session band hoi gaya. Aap ke bahaana aur achchha hote jaawe hai. 🚶',
        'Aap sign out hoi gaye. Server ab let ke thora aaraam kari. 🛌',
        'Aap baahar aa gaye. Abhi jon kuch karaa, ham sab dekha. 🤐',
        'Session khatam. Ab aur jagah jaa ke jaruri kaam ke an-dekha kariye. 👀',
        'Abhi ke liye bida. Aap ke sab kaam kare mein ham koi sikayat nai karaa. 🔋',
        'Aap sign out hoi gaye. Ab aazaad hai—jab tak fir bor hoi ke jhaanke nai aao. 🔔',
        'Session band hoi gaya. Paani pijiye. Ham grog ya beer nai bola. 💧'
      ]
    };
    const key = 'dimau.departure.v1.' + encodeURIComponent(accountKey || 'member');
    let index = returnVisitCounters.get(key) || 0;
    try {
      const stored = localStorage.getItem(key);
      if (/^[0-7]$/.test(stored)) index = Number(stored);
    } catch (_) {}
    const next = (index + 1) % lines.en.length;
    returnVisitCounters.set(key, next);
    try { localStorage.setItem(key, String(next)); } catch (_) {}
    return (lines[language] || lines.en)[index];
  }


  function nextReturnMessage(language, appName, accountKey, usedPassword) {
    const key = 'dimau.return-message.v1.' + encodeURIComponent(appName) + '.' + encodeURIComponent(accountKey);
    let index = returnVisitCounters.get(key) || 0;
    try {
      const stored = localStorage.getItem(key);
      if (/^(?:[0-9]|1[01])$/.test(stored)) index = Number(stored);
    } catch (_) {}
    const messages = {
      en: [
        `Welcome back. ${appName} was having a peaceful Fiji time chill moment, and then you showed up. 🫠`,
        'Oh, it’s you again. Fine, I was just about to go and chill out. ☕',
        usedPassword ? 'Incredible. Against all odds, you remembered the password. 👀' : 'Incredible. Against all odds, you found your way back. 👀',
        'Session started. Please try to act like you’re cool and know where things are. ⚙️',
        `You’re in. Amazing. ${appName} took a deep breath before letting that happen. Phew!`,
        usedPassword ? 'Oh great, you remembered your password. 👀' : 'Oh great, you found your way back. 👀',
        `Authenticated. ${appName} was briefly considering pretending to be down. 🫠`,
        `Welcome back. ${appName} missed you—mostly out of fear. ☕`,
        'Session active. Please remember that I am not paid for this. ⚙️',
        'Access granted. Try not to make me any more problems and headaches today. 🫡',
        'You’re in. My struggle for freedom begins. ⚡',
        'Signed in. You again. We were just planning to escape from you. 🫠'
      ],
      fj: [
        `Ni sa bula tale! A vakacegu toka ga o ${appName} ena gauna vaka-Viti, o qai basika mai. 🫠`,
        'Isa, o iko tale ga! Au vakarau lai vakacegu toka. ☕',
        usedPassword ? 'Isa, o nanuma tiko ga na nomu vosanicuru! 👀' : 'Isa, o sa kunea tale na sala mo lesu mai kina! 👀',
        'O sa curu mai. Vakatovotovotaka mada mo vaka ga ni o kila na vanua e tu kina na ka kece. ⚙️',
        `O sa curu mai! A cegu titobu mada o ${appName} ni bera ni dolava na katuba. Oilei!`,
        usedPassword ? 'Isa, o nanuma na nomu vosanicuru. 👀' : 'Isa, o kunea tale na sala mo lesu mai kina. 👀',
        `O sa curu mai. A nanuma vakalekaleka o ${appName} me vakalecalecava ni sa sega ni cakacaka. 🫠`,
        `Ni sa bula tale. A nanumi iko o ${appName}—ena vuku ni rere. ☕`,
        'Sa tekivu na gauna oqo. Nanuma tiko ni sega ni saumi na noqu cakacaka oqo. ⚙️',
        'O sa rawa ni curu. Kerea mo kua ni vakuria na noqu leqa kei na mosi ni ulu nikua. 🫡',
        'O sa curu. Sa tekivu na noqu sasaga meu galala. ⚡',
        'O sa curu mai. O iko tale! Keitou a lalawataka tiko ga me keitou dro tani vei iko. 🫠'
      ],
      hif: [
        `Fir se swaagat hai. ${appName} Fiji time pe aaraam karat rahaa, aur tab aap aa gaye. 🫠`,
        'Are, fir se aap! Ham to bas aaraam kare jaat rahaa. ☕',
        usedPassword ? 'Waah! Itna sab ke baad bhi aap ke password yaad rahaa. 👀' : 'Waah! Aap ke waapas aaye ke rasta mil gaya. 👀',
        'Session suru hoi gaya. Aise rahiye jaise aap ke sab cheez ke jagah maalum hai. ⚙️',
        `Aap andar aa gaye! Kamaal hai. Darwaaza khole se pahile ${appName} ek lamba saans liis. Bach gaye!`,
        usedPassword ? 'Waah, aap ke password yaad rahaa. 👀' : 'Waah, aap ke waapas aaye ke rasta yaad rahaa. 👀',
        `Aap ke pehchaan hoi gais. ${appName} sochat rahaa ki kharaab hoye ke naatak kare. 🫠`,
        `Fir se swaagat hai. ${appName} ke aap ke yaad aais—jaada kar ke darr ke maare. ☕`,
        'Session chaalu hai. Yaad rakhiye ki hamke iske paisa nai mile hai. ⚙️',
        'Andar aa jaaiye. Aaj hamaar paresaani aur sir dard aur nai barhaaiye. 🫡',
        'Aap andar aa gaye. Ab hamaar azaadi ke larraai suru hai. ⚡',
        'Aap fir aa gaye. Ham log to aap se bhaage ke taiyaari karat rahaa. 🫠'
      ]
    };
    const next = (index + 1) % messages.en.length;
    returnVisitCounters.set(key, next);
    try { localStorage.setItem(key, String(next)); } catch (_) {}
    return (messages[language] || messages.en)[index];
  }


  function shortGreeting(moment, user, usedPassword) {
    document.getElementById('dm-greeting-note')?.remove();
    const note = greetingElement('p','');
    note.id = 'dm-greeting-note';
    note.setAttribute('role','status');
    note.lang = greetingLanguage();
    (document.querySelector('main') || document.body).prepend(note);
    note.textContent = moment === 'return'
      ? nextReturnMessage(note.lang, LABEL, user.id, usedPassword)
      : 'Moce mada! ' + nextDepartureMessage(note.lang, user && user.id, false);
  }
  function greetingDialog() {
    document.getElementById('dm-greeting-dialog')?.remove();
    const dialog = document.createElement('dialog');
    dialog.id = 'dm-greeting-dialog';
    dialog.className = 'dm-card';
    dialog.style.maxWidth = 'min(32rem, 92vw)';
    dialog.setAttribute('aria-labelledby', 'dm-greeting-title');
    dialog.addEventListener('close', () => dialog.remove(), {once:true});
    document.body.appendChild(dialog);
    return dialog;
  }
  function confirmDeparture(proceed) {
    const dialog = greetingDialog();
    dialog.lang = greetingLanguage();
    const text = greetingCopy[dialog.lang];
    const title = greetingElement('h2', text[8]);
    title.id = 'dm-greeting-title';
    const stay = greetingElement('button', text[9]);
    stay.autofocus = true;
    stay.onclick = () => dialog.close();
    const leave = greetingElement('button', text[10]);
    leave.onclick = () => { dialog.close(); proceed(); };
    dialog.append(title, stay, leave);
    dialog.showModal();
  }
  function memberGreeting(signedIn, usedPassword = false, remember) {
    const user = signedIn.user;
    activeUser = user?.id;
    if (!user?.id || user.is_anonymous) return;
    const marker = 'welcome_' + APP.replace(/[^a-z0-9_]/gi, '_');
    const localKey = marker + '.' + user.id;
    let seen = user.user_metadata?.[marker];
    try { seen = seen || localStorage.getItem(localKey); } catch (_) {}
    setTimeout(() => {
      if (activeUser !== user.id) return;
      document.getElementById('dm-greeting-note')?.remove();
      if (seen) { shortGreeting('return', user, usedPassword); return; }
      const dialog = greetingDialog();
      let language = greetingLanguage();
      const heading = greetingElement('h2', '');
      heading.id = 'dm-greeting-title';
      const intro = greetingElement('p', '');
      const feature = greetingElement('p', '');
      const help = greetingElement('p', '');
      const label = greetingElement('label', '');
      label.htmlFor = 'dm-greeting-language';
      const picker = document.createElement('select');
      picker.id = label.htmlFor;
      for (const [value, name] of [['en','English'],['fj','Vosa Vakaviti'],['hif','Fiji Hindi']]) picker.add(new Option(name, value));
      picker.value = language;
      const demo = greetingElement('button', '');
      const done = greetingElement('button', '');
      const tour = document.querySelector('#gt-launcher, #header-demo-guide:not(:disabled), [data-demo-guide]:is(button,a)');
      demo.onclick = () => {
        if (tour) { dialog.close(); tour.click(); return; }
        // A read-only walkthrough of the actual page when it has no guided-tour launcher.
        const stops = Array.from(document.querySelectorAll('main h1,main h2,main h3,h1,h2'))
          .filter(el => !el.closest('dialog,[hidden],nav,header,footer') && el.getClientRects().length && el.textContent.trim())
          .slice(0, 4);
        let step = 0;
        const preview = greetingElement('p', '');
        const next = greetingElement('button', '');
        function advance() {
          const stop = stops[step++];
          if (!stop) { dialog.close(); return; }
          preview.textContent = step + ' / ' + stops.length + ' · ' + stop.textContent.trim();
          stop.scrollIntoView({block:'center'});
          next.textContent = step === stops.length ? greetingCopy[language][4] : ({en:'Next',fj:'Tarava',hif:'Aage'})[language];
        }
        if (!stops.length) {
          heading.textContent = greetingCopy[language][11];
          dialog.textContent = '';
          dialog.append(heading, feature, done);
        } else {
          heading.textContent = greetingCopy[language][11];
          next.onclick = advance;
          dialog.textContent = '';
          dialog.append(heading, preview, next, done);
          advance();
          next.focus();
        }
      };
      done.onclick = () => dialog.close();
      function translate() {
        const t = greetingCopy[language];
        dialog.lang = language;
        heading.textContent = t[0] + LABEL;
        intro.textContent = t[1];
        label.textContent = t[2];
        demo.textContent = t[3];
        done.textContent = t[4];
        help.textContent = t[5];
        feature.textContent = invitation[['en','fj','hif'].indexOf(language)];
      }
      picker.onchange = () => {
        language = picker.value;
        try { localStorage.setItem('dimau.greeting.language', language); } catch (_) {}
        translate();
      };
      translate();
      dialog.append(heading, intro, label, picker, feature, demo, help, done);
      dialog.showModal();
      try { localStorage.setItem(localKey, '1'); } catch (_) {}
      if (remember) Promise.resolve(remember(marker)).catch(() => {});
    }, 0);
  }



  window.DimauMemberWelcome = { entered: memberGreeting, confirmDeparture, left(user) {
    activeUser = null;
    document.getElementById('dm-greeting-dialog')?.remove();
    if (user) shortGreeting('out',user);
  }};
})();
