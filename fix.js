const fs = require('fs');
const file = 'src/renderer/src/pages/PageSettings.tsx';
let content = fs.readFileSync(file, 'utf8');

// The file might contain broken duplicated tags, so regex extraction of cards is better.
const cardRegex = /<Card[\s\S]*?<\/Card>/g;
const cards = content.match(cardRegex) || [];

function getCard(titleContains) {
  return cards.find(c => c.includes('title=\"' + titleContains)) || '';
}

const cProfile = getCard('Profil');
const cTheme = getCard('Görünüm');
const cDesktop = getCard('Masaüstü');
const cEmail = getCard('E-Posta');

const cDay = getCard('Gün');
const cNotify = getCard('Bildirimler');
const cCapacity = getCard('Günlük kapasite');
const cRepeat = getCard('Tekrarlayan görevler');
const cPomo = getCard('Pomodoro') || getCard('Odaklanma (Pomodoro)');

const cKeys = getCard('Kısayollar') || getCard('Klavye kısayolları');
const cData = getCard('Veri');

// Find prefix before the main grid
const prefixMatch = content.match(/([\s\S]*?)<div className=\"grid grid-cols-1 gap-5 lg:grid-cols-2\">/);
let prefix = prefixMatch ? prefixMatch[1] : '';

// Ensure prefix contains <Dialog open={!!confirm} correctly if we accidentally mess it up, but it's at the end.
const suffixMatch = content.match(/<Dialog open=\{\!\!confirm\}[\s\S]*/);
const suffix = suffixMatch ? suffixMatch[0] : '';

const newGrid = `
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {tab === 'general' && (
          <>
            ${cProfile}
            ${cTheme}
            ${cDesktop}
            ${cEmail}
          </>
        )}

        {tab === 'planning' && (
          <>
            ${cDay}
            <div className="lg:col-span-2">${cNotify}</div>
            <div className="lg:col-span-2">${cCapacity}</div>
            <div className="lg:col-span-2">${cPomo}</div>
            <div className="lg:col-span-2">${cRepeat}</div>
          </>
        )}

        {tab === 'advanced' && (
          <>
            <div className="lg:col-span-2">
              <ProfileSecurity />
            </div>
            <div className="lg:col-span-2">${cKeys}</div>
            <div className="lg:col-span-2">${cData}</div>
          </>
        )}
      </div>
      ${suffix}
    </Page>
  )
}
`;

fs.writeFileSync(file, prefix + newGrid);
console.log('Fixed settings UI');
