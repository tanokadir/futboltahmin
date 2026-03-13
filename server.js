const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Headers
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
    "script-src * 'unsafe-inline' 'unsafe-eval'; " +
    "connect-src * ws: wss:; " +
    "style-src * 'unsafe-inline';"
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Rooms ──
// rooms[code] = {
//   code, players: [{id, name, score}], 
//   host, state:'lobby'|'playing'|'result'|'final',
//   round:0, curPlayer, hintsOpen:0, wrongPerPlayer:{id:n},
//   donePlayers: Set, solved:false, timerInt, timerLeft
// }
const rooms = {};

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

// 100 player database (same as client)
const DB = [
  {n:"Lionel Messi",f:"AR",c:"Arjantin",age:38,pos:"Sag Kanat",foot:"Sol",h:170,w:72,val:"15M",club:"Inter Miami",no:10,lig:"MLS"},
  {n:"Cristiano Ronaldo",f:"PT",c:"Portekiz",age:41,pos:"Forvet",foot:"Sag",h:187,w:85,val:"5M",club:"Al Nassr",no:7,lig:"Saudi Pro Ligi"},
  {n:"Erling Haaland",f:"NO",c:"Norvec",age:25,pos:"Santrfor",foot:"Sol",h:194,w:88,val:"200M",club:"Manchester City",no:9,lig:"Premier Lig"},
  {n:"Kylian Mbappe",f:"FR",c:"Fransa",age:27,pos:"Forvet",foot:"Sag",h:178,w:73,val:"200M",club:"Real Madrid",no:9,lig:"La Liga"},
  {n:"Vinicius Jr",f:"BR",c:"Brezilya",age:25,pos:"Sol Kanat",foot:"Sag",h:176,w:73,val:"200M",club:"Real Madrid",no:7,lig:"La Liga"},
  {n:"Lamine Yamal",f:"ES",c:"Ispanya",age:18,pos:"Sag Kanat",foot:"Sol",h:182,w:67,val:"250M",club:"Barcelona",no:19,lig:"La Liga"},
  {n:"Jude Bellingham",f:"EN",c:"Ingiltere",age:22,pos:"Merkez MF",foot:"Sag",h:186,w:83,val:"200M",club:"Real Madrid",no:5,lig:"La Liga"},
  {n:"Mohamed Salah",f:"EG",c:"Misir",age:33,pos:"Sag Kanat",foot:"Sol",h:175,w:71,val:"40M",club:"Liverpool",no:11,lig:"Premier Lig"},
  {n:"Harry Kane",f:"EN",c:"Ingiltere",age:32,pos:"Santrfor",foot:"Sag",h:188,w:86,val:"70M",club:"Bayern Munih",no:9,lig:"Bundesliga"},
  {n:"Bukayo Saka",f:"EN",c:"Ingiltere",age:24,pos:"Sag Kanat",foot:"Sol",h:178,w:72,val:"180M",club:"Arsenal",no:7,lig:"Premier Lig"},
  {n:"Phil Foden",f:"EN",c:"Ingiltere",age:25,pos:"Attacking MF",foot:"Sol",h:171,w:70,val:"160M",club:"Manchester City",no:47,lig:"Premier Lig"},
  {n:"Florian Wirtz",f:"DE",c:"Almanya",age:22,pos:"Attacking MF",foot:"Sag",h:176,w:70,val:"200M",club:"Bayern Munih",no:10,lig:"Bundesliga"},
  {n:"Jamal Musiala",f:"DE",c:"Almanya",age:22,pos:"Attacking MF",foot:"Sol",h:183,w:70,val:"180M",club:"Bayern Munih",no:42,lig:"Bundesliga"},
  {n:"Cole Palmer",f:"EN",c:"Ingiltere",age:23,pos:"Attacking MF",foot:"Sag",h:185,w:76,val:"150M",club:"Chelsea",no:20,lig:"Premier Lig"},
  {n:"Martin Odegaard",f:"NO",c:"Norvec",age:27,pos:"Attacking MF",foot:"Sag",h:178,w:68,val:"110M",club:"Arsenal",no:8,lig:"Premier Lig"},
  {n:"Rodri",f:"ES",c:"Ispanya",age:29,pos:"Def MF",foot:"Sag",h:191,w:82,val:"130M",club:"Manchester City",no:16,lig:"Premier Lig"},
  {n:"Kevin De Bruyne",f:"BE",c:"Belcika",age:34,pos:"Attacking MF",foot:"Sag",h:181,w:70,val:"20M",club:"Manchester City",no:17,lig:"Premier Lig"},
  {n:"Pedri",f:"ES",c:"Ispanya",age:23,pos:"Merkez MF",foot:"Sag",h:174,w:60,val:"120M",club:"Barcelona",no:8,lig:"La Liga"},
  {n:"Raphinha",f:"BR",c:"Brezilya",age:29,pos:"Sag Kanat",foot:"Sol",h:176,w:68,val:"90M",club:"Barcelona",no:11,lig:"La Liga"},
  {n:"Federico Valverde",f:"UY",c:"Uruguay",age:27,pos:"Merkez MF",foot:"Sag",h:182,w:78,val:"130M",club:"Real Madrid",no:8,lig:"La Liga"},
  {n:"Lautaro Martinez",f:"AR",c:"Arjantin",age:28,pos:"Santrfor",foot:"Sag",h:174,w:72,val:"110M",club:"Inter Milan",no:10,lig:"Serie A"},
  {n:"Victor Osimhen",f:"NG",c:"Nijerya",age:27,pos:"Santrfor",foot:"Sag",h:185,w:78,val:"80M",club:"Galatasaray",no:9,lig:"Super Lig"},
  {n:"Khvicha Kvaratskhelia",f:"GE",c:"Grcistan",age:24,pos:"Sol Kanat",foot:"Sag",h:183,w:74,val:"100M",club:"PSG",no:77,lig:"Ligue 1"},
  {n:"Rafael Leao",f:"PT",c:"Portekiz",age:26,pos:"Sol Kanat",foot:"Sag",h:188,w:78,val:"80M",club:"AC Milan",no:10,lig:"Serie A"},
  {n:"Arda Guler",f:"TR",c:"Turkiye",age:20,pos:"Attacking MF",foot:"Sol",h:176,w:65,val:"80M",club:"Real Madrid",no:24,lig:"La Liga"},
  {n:"Hakan Calhanoglu",f:"TR",c:"Turkiye",age:32,pos:"Def MF",foot:"Sol",h:179,w:78,val:"30M",club:"Inter Milan",no:20,lig:"Serie A"},
  {n:"Kenan Yildiz",f:"TR",c:"Turkiye",age:20,pos:"Sol Kanat",foot:"Sag",h:183,w:73,val:"45M",club:"Juventus",no:10,lig:"Serie A"},
  {n:"Baris Alper Yilmaz",f:"TR",c:"Turkiye",age:25,pos:"Sol Kanat",foot:"Sag",h:177,w:71,val:"25M",club:"Galatasaray",no:17,lig:"Super Lig"},
  {n:"Irfan Can Kahveci",f:"TR",c:"Turkiye",age:30,pos:"Attacking MF",foot:"Sag",h:176,w:70,val:"12M",club:"Fenerbahce",no:10,lig:"Super Lig"},
  {n:"Antoine Griezmann",f:"FR",c:"Fransa",age:35,pos:"Forvet",foot:"Sol",h:176,w:73,val:"15M",club:"Atletico Madrid",no:7,lig:"La Liga"},
  {n:"Robert Lewandowski",f:"PL",c:"Polonya",age:37,pos:"Santrfor",foot:"Sag",h:185,w:80,val:"10M",club:"Barcelona",no:9,lig:"La Liga"},
  {n:"Son Heung-min",f:"KR",c:"Guney Kore",age:34,pos:"Sol Kanat",foot:"Sol",h:183,w:78,val:"20M",club:"Tottenham",no:7,lig:"Premier Lig"},
  {n:"Marcus Rashford",f:"EN",c:"Ingiltere",age:28,pos:"Sol Kanat",foot:"Sag",h:180,w:70,val:"35M",club:"Aston Villa",no:10,lig:"Premier Lig"},
  {n:"Bernardo Silva",f:"PT",c:"Portekiz",age:31,pos:"Attacking MF",foot:"Sag",h:173,w:64,val:"70M",club:"Manchester City",no:20,lig:"Premier Lig"},
  {n:"Trent Alexander-Arnold",f:"EN",c:"Ingiltere",age:27,pos:"Sag Bek",foot:"Sag",h:175,w:69,val:"80M",club:"Real Madrid",no:12,lig:"La Liga"},
  {n:"Ruben Dias",f:"PT",c:"Portekiz",age:28,pos:"Stoper",foot:"Sag",h:187,w:76,val:"80M",club:"Manchester City",no:3,lig:"Premier Lig"},
  {n:"Virgil van Dijk",f:"NL",c:"Hollanda",age:34,pos:"Stoper",foot:"Sag",h:193,w:92,val:"25M",club:"Liverpool",no:4,lig:"Premier Lig"},
  {n:"Gianluigi Donnarumma",f:"IT",c:"Italya",age:27,pos:"Kaleci",foot:"Sol",h:196,w:90,val:"55M",club:"PSG",no:99,lig:"Ligue 1"},
  {n:"Jonathan David",f:"CA",c:"Kanada",age:25,pos:"Santrfor",foot:"Sag",h:178,w:74,val:"70M",club:"Lille",no:9,lig:"Ligue 1"},
  {n:"Ademola Lookman",f:"NG",c:"Nijerya",age:28,pos:"Sol Kanat",foot:"Sag",h:175,w:70,val:"65M",club:"Atalanta",no:11,lig:"Serie A"},
  {n:"Achraf Hakimi",f:"MA",c:"Fas",age:27,pos:"Sag Bek",foot:"Sag",h:181,w:73,val:"75M",club:"PSG",no:2,lig:"Ligue 1"},
  {n:"Theo Hernandez",f:"FR",c:"Fransa",age:28,pos:"Sol Bek",foot:"Sol",h:184,w:84,val:"65M",club:"AC Milan",no:19,lig:"Serie A"},
  {n:"Declan Rice",f:"EN",c:"Ingiltere",age:27,pos:"Def MF",foot:"Sag",h:185,w:82,val:"110M",club:"Arsenal",no:41,lig:"Premier Lig"},
  {n:"Dani Olmo",f:"ES",c:"Ispanya",age:27,pos:"Attacking MF",foot:"Sag",h:178,w:70,val:"90M",club:"Barcelona",no:20,lig:"La Liga"},
  {n:"Warren Zaire-Emery",f:"FR",c:"Fransa",age:19,pos:"Merkez MF",foot:"Sag",h:178,w:68,val:"80M",club:"PSG",no:33,lig:"Ligue 1"},
  {n:"Tijjani Reijnders",f:"NL",c:"Hollanda",age:27,pos:"Merkez MF",foot:"Sag",h:182,w:75,val:"70M",club:"AC Milan",no:14,lig:"Serie A"},
  {n:"Gavi",f:"ES",c:"Ispanya",age:21,pos:"Merkez MF",foot:"Sol",h:173,w:60,val:"70M",club:"Barcelona",no:6,lig:"La Liga"},
  {n:"Nicolo Barella",f:"IT",c:"Italya",age:28,pos:"Merkez MF",foot:"Sag",h:172,w:68,val:"90M",club:"Inter Milan",no:23,lig:"Serie A"},
  {n:"Marcus Thuram",f:"FR",c:"Fransa",age:28,pos:"Santrfor",foot:"Sag",h:192,w:85,val:"65M",club:"Inter Milan",no:9,lig:"Serie A"},
  {n:"William Saliba",f:"FR",c:"Fransa",age:24,pos:"Stoper",foot:"Sag",h:192,w:91,val:"100M",club:"Arsenal",no:12,lig:"Premier Lig"},
  {n:"Ousmane Dembele",f:"FR",c:"Fransa",age:28,pos:"Sag Kanat",foot:"Sol",h:178,w:67,val:"60M",club:"PSG",no:10,lig:"Ligue 1"},
  {n:"Bradley Barcola",f:"FR",c:"Fransa",age:23,pos:"Sol Kanat",foot:"Sag",h:180,w:70,val:"90M",club:"PSG",no:29,lig:"Ligue 1"},
  {n:"Ciro Immobile",f:"IT",c:"Italya",age:36,pos:"Santrfor",foot:"Sag",h:185,w:80,val:"5M",club:"Besiktas",no:17,lig:"Super Lig"},
  {n:"Joshua Kimmich",f:"DE",c:"Almanya",age:31,pos:"Sag Bek/MF",foot:"Sag",h:177,w:75,val:"60M",club:"Bayern Munih",no:6,lig:"Bundesliga"},
  {n:"Alphonso Davies",f:"CA",c:"Kanada",age:25,pos:"Sol Bek",foot:"Sol",h:183,w:63,val:"70M",club:"Bayern Munih",no:19,lig:"Bundesliga"},
  {n:"Jan Oblak",f:"SI",c:"Slovenya",age:33,pos:"Kaleci",foot:"Sag",h:188,w:87,val:"25M",club:"Atletico Madrid",no:13,lig:"La Liga"},
  {n:"Ederson",f:"BR",c:"Brezilya",age:32,pos:"Kaleci",foot:"Sol",h:188,w:86,val:"30M",club:"Manchester City",no:31,lig:"Premier Lig"},
  {n:"David Raya",f:"ES",c:"Ispanya",age:30,pos:"Kaleci",foot:"Sag",h:183,w:83,val:"40M",club:"Arsenal",no:22,lig:"Premier Lig"},
  {n:"Antonio Rudiger",f:"DE",c:"Almanya",age:32,pos:"Stoper",foot:"Sag",h:190,w:85,val:"25M",club:"Real Madrid",no:22,lig:"La Liga"},
  {n:"Jules Kounde",f:"FR",c:"Fransa",age:27,pos:"Sag Bek",foot:"Sag",h:178,w:75,val:"70M",club:"Barcelona",no:23,lig:"La Liga"},
  {n:"Pau Cubarsi",f:"ES",c:"Ispanya",age:18,pos:"Stoper",foot:"Sol",h:184,w:77,val:"80M",club:"Barcelona",no:3,lig:"La Liga"},
  {n:"Frenkie de Jong",f:"NL",c:"Hollanda",age:28,pos:"Merkez MF",foot:"Sag",h:180,w:74,val:"40M",club:"Barcelona",no:21,lig:"La Liga"},
  {n:"Mike Maignan",f:"FR",c:"Fransa",age:30,pos:"Kaleci",foot:"Sag",h:191,w:83,val:"55M",club:"AC Milan",no:16,lig:"Serie A"},
  {n:"Alisson Becker",f:"BR",c:"Brezilya",age:33,pos:"Kaleci",foot:"Sag",h:193,w:91,val:"35M",club:"Liverpool",no:1,lig:"Premier Lig"},
  {n:"Ferran Torres",f:"ES",c:"Ispanya",age:25,pos:"Sol Kanat",foot:"Sag",h:184,w:76,val:"45M",club:"Barcelona",no:7,lig:"La Liga"},
  {n:"Ruben Neves",f:"PT",c:"Portekiz",age:28,pos:"Def MF",foot:"Sag",h:181,w:78,val:"35M",club:"Al Qadsiah",no:8,lig:"Saudi Pro Ligi"},
  {n:"Dominik Szoboszlai",f:"HU",c:"Macaristan",age:24,pos:"Attacking MF",foot:"Sol",h:186,w:75,val:"70M",club:"Liverpool",no:8,lig:"Premier Lig"},
  {n:"Granit Xhaka",f:"CH",c:"Isvicre",age:33,pos:"Def MF",foot:"Sol",h:185,w:80,val:"18M",club:"Bayer Leverkusen",no:34,lig:"Bundesliga"},
  {n:"Alejandro Grimaldo",f:"ES",c:"Ispanya",age:30,pos:"Sol Bek",foot:"Sol",h:170,w:68,val:"45M",club:"Bayer Leverkusen",no:12,lig:"Bundesliga"},
  {n:"Artem Dovbyk",f:"UA",c:"Ukrayna",age:28,pos:"Santrfor",foot:"Sag",h:190,w:85,val:"45M",club:"Roma",no:11,lig:"Serie A"},
  {n:"Matheus Cunha",f:"BR",c:"Brezilya",age:26,pos:"Forvet",foot:"Sag",h:181,w:77,val:"65M",club:"Wolverhampton",no:12,lig:"Premier Lig"},
  {n:"Bryan Mbeumo",f:"CM",c:"Kamerun",age:25,pos:"Sag Kanat",foot:"Sol",h:175,w:72,val:"70M",club:"Brentford",no:19,lig:"Premier Lig"},
  {n:"Yoane Wissa",f:"CD",c:"Kongo",age:28,pos:"Sol Kanat",foot:"Sag",h:176,w:68,val:"40M",club:"Brentford",no:11,lig:"Premier Lig"},
  {n:"Diogo Jota",f:"PT",c:"Portekiz",age:29,pos:"Sol Kanat",foot:"Sag",h:178,w:70,val:"55M",club:"Liverpool",no:20,lig:"Premier Lig"},
  {n:"Cody Gakpo",f:"NL",c:"Hollanda",age:26,pos:"Sol Kanat",foot:"Sag",h:189,w:80,val:"60M",club:"Liverpool",no:18,lig:"Premier Lig"},
  {n:"Alexis Mac Allister",f:"AR",c:"Arjantin",age:27,pos:"Merkez MF",foot:"Sag",h:174,w:73,val:"80M",club:"Liverpool",no:10,lig:"Premier Lig"},
  {n:"Michael Olise",f:"FR",c:"Fransa",age:24,pos:"Sag Kanat",foot:"Sol",h:183,w:75,val:"80M",club:"Bayern Munih",no:8,lig:"Bundesliga"},
  {n:"Serhou Guirassy",f:"GN",c:"Gine",age:29,pos:"Santrfor",foot:"Sag",h:187,w:83,val:"55M",club:"Borussia Dortmund",no:19,lig:"Bundesliga"},
  {n:"Karim Adeyemi",f:"DE",c:"Almanya",age:23,pos:"Sol Kanat",foot:"Sag",h:180,w:72,val:"45M",club:"Borussia Dortmund",no:27,lig:"Bundesliga"},
  {n:"Gregor Kobel",f:"CH",c:"Isvicre",age:27,pos:"Kaleci",foot:"Sag",h:194,w:90,val:"40M",club:"Borussia Dortmund",no:1,lig:"Bundesliga"},
  {n:"Nico Williams",f:"ES",c:"Ispanya",age:22,pos:"Sol Kanat",foot:"Sag",h:180,w:67,val:"120M",club:"Athletic Bilbao",no:10,lig:"La Liga"},
  {n:"Alvaro Morata",f:"ES",c:"Ispanya",age:33,pos:"Santrfor",foot:"Sag",h:187,w:80,val:"10M",club:"AC Milan",no:7,lig:"Serie A"},
  {n:"Goncalo Ramos",f:"PT",c:"Portekiz",age:24,pos:"Santrfor",foot:"Sag",h:187,w:79,val:"65M",club:"PSG",no:9,lig:"Ligue 1"},
  {n:"Pedro Neto",f:"PT",c:"Portekiz",age:25,pos:"Sag Kanat",foot:"Sol",h:173,w:64,val:"70M",club:"Chelsea",no:7,lig:"Premier Lig"},
  {n:"Noni Madueke",f:"EN",c:"Ingiltere",age:23,pos:"Sag Kanat",foot:"Sol",h:180,w:72,val:"55M",club:"Chelsea",no:11,lig:"Premier Lig"},
  {n:"Leny Yoro",f:"FR",c:"Fransa",age:19,pos:"Stoper",foot:"Sag",h:194,w:82,val:"70M",club:"Man United",no:15,lig:"Premier Lig"},
  {n:"Rasmus Hojlund",f:"DK",c:"Danimarka",age:22,pos:"Santrfor",foot:"Sag",h:191,w:82,val:"55M",club:"Man United",no:11,lig:"Premier Lig"},
  {n:"James Maddison",f:"EN",c:"Ingiltere",age:29,pos:"Attacking MF",foot:"Sag",h:177,w:71,val:"45M",club:"Tottenham",no:10,lig:"Premier Lig"},
  {n:"Heung-min Son",f:"KR",c:"Guney Kore",age:34,pos:"Sol Kanat",foot:"Sol",h:183,w:78,val:"18M",club:"Tottenham",no:7,lig:"Premier Lig"},
  {n:"Leandro Trossard",f:"BE",c:"Belcika",age:30,pos:"Sol Kanat",foot:"Sag",h:172,w:66,val:"40M",club:"Arsenal",no:19,lig:"Premier Lig"},
  {n:"Riccardo Calafiori",f:"IT",c:"Italya",age:23,pos:"Sol Bek",foot:"Sol",h:187,w:83,val:"55M",club:"Arsenal",no:33,lig:"Premier Lig"},
  {n:"Youri Tielemans",f:"BE",c:"Belcika",age:28,pos:"Merkez MF",foot:"Sag",h:178,w:74,val:"30M",club:"Aston Villa",no:8,lig:"Premier Lig"},
  {n:"Ollie Watkins",f:"EN",c:"Ingiltere",age:30,pos:"Santrfor",foot:"Sag",h:180,w:70,val:"55M",club:"Aston Villa",no:11,lig:"Premier Lig"},
  {n:"Morgan Rogers",f:"EN",c:"Ingiltere",age:23,pos:"Attacking MF",foot:"Sag",h:188,w:80,val:"50M",club:"Aston Villa",no:10,lig:"Premier Lig"},
  {n:"Viktor Gyokeres",f:"SE",c:"Isvec",age:27,pos:"Santrfor",foot:"Sag",h:187,w:86,val:"100M",club:"Sporting CP",no:9,lig:"Primeira Liga"},
  {n:"Joao Felix",f:"PT",c:"Portekiz",age:26,pos:"Attacking MF",foot:"Sag",h:181,w:70,val:"35M",club:"Chelsea",no:11,lig:"Premier Lig"},
];

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function buildClues(p) {
  return {
    always: [
      { l: 'YAS',    v: p.age + ' yasinda' },
      { l: 'UYRUK',  v: '[' + p.f + '] ' + p.c },
      { l: 'BOY',    v: p.h + ' cm' },
      { l: 'KILO',   v: p.w + ' kg' },
      { l: 'MEVKi',  v: p.pos },
      { l: 'KULUP',  v: p.club },
    ],
    hints: [
      { l: 'AYAK',   v: p.foot + ' Ayak' },
      { l: 'PIYASA', v: p.val + ' EUR' },
      { l: 'FORMA',  v: '#' + p.no },
      { l: 'LIG',    v: p.lig },
    ]
  };
}

// ── Socket events ──
io.on('connection', (socket) => {

  // Create room
  socket.on('create_room', ({ name }) => {
    let code = makeCode();
    while (rooms[code]) code = makeCode();
    rooms[code] = {
      code,
      host: socket.id,
      players: [{ id: socket.id, name: name || 'Oyuncu 1', score: 0 }],
      state: 'lobby',
      usedPlayers: [],
      round: 0,
      curPlayer: null,
      hintsOpen: 0,
      wrongPerPlayer: {},
      donePlayers: new Set(),
      solved: false,
      timerInt: null,
      timerLeft: 30,
    };
    socket.join(code);
    socket.roomCode = code;
    socket.emit('room_created', { code, players: rooms[code].players });
  });

  // Join room
  socket.on('join_room', ({ code, name }) => {
    code = code.toUpperCase().trim();
    const room = rooms[code];
    if (!room) { socket.emit('error', 'Oda bulunamadi!'); return; }
    if (room.state !== 'lobby') { socket.emit('error', 'Oyun zaten basladi!'); return; }
    if (room.players.length >= 4) { socket.emit('error', 'Oda dolu!'); return; }

    room.players.push({ id: socket.id, name: name || ('Oyuncu ' + (room.players.length + 1)), score: 0 });
    socket.join(code);
    socket.roomCode = code;
    io.to(code).emit('players_updated', { players: room.players });
    socket.emit('room_joined', { code, players: room.players });
  });

  // Start game (host only)
  socket.on('start_game', (data) => {
    const room = rooms[socket.roomCode];
    if (!room || socket.id !== room.host) return;
    if (room.players.length < 2) { socket.emit('error', 'En az 2 oyuncu gerekli!'); return; }
    room.state = 'playing';
    room.round = 0;
    room.totalRounds = (data && data.rounds) ? data.rounds : 7;
    room.players.forEach(p => p.score = 0);
    startRound(room);
  });

  // Guess
  socket.on('guess', ({ guess }) => {
    const room = rooms[socket.roomCode];
    if (!room || room.state !== 'playing') return;
    if (room.solved) return;
    if (room.donePlayers.has(socket.id)) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const correct = guess.trim().toLowerCase() === room.curPlayer.n.toLowerCase();

    if (correct) {
      // Dogru!
      room.solved = true;
      clearInterval(room.timerInt);
      const pts = Math.max(20, 60 + room.timerLeft - room.hintsOpen * 8);
      player.score += pts;
      room.donePlayers = new Set(room.players.map(p => p.id)); // lock all

      io.to(room.code).emit('round_result', {
        win: true,
        winnerId: socket.id,
        winnerName: player.name,
        pts,
        answer: room.curPlayer.n,
        players: room.players,
      });
      room.state = 'result';

    } else {
      // Yanlis
      room.wrongPerPlayer[socket.id] = (room.wrongPerPlayer[socket.id] || 0) + 1;

      // Her yanlis bir ipucu acar (ortak)
      if (room.hintsOpen < 4) {
        room.hintsOpen++;
        io.to(room.code).emit('hint_opened', {
          hintsOpen: room.hintsOpen,
          hint: room.curPlayer ? buildClues(room.curPlayer).hints[room.hintsOpen - 1] : null
        });
      }

      // Once all hints open, only 1 guess remains
      let wrong = room.wrongPerPlayer[socket.id];
      if (room.hintsOpen >= 4 && wrong < 4) {
        room.wrongPerPlayer[socket.id] = 4;
        wrong = 4;
      }
      const remaining = 5 - wrong;

      if (remaining <= 0) {
        room.donePlayers.add(socket.id);
        io.to(room.code).emit('player_eliminated', { id: socket.id, name: player.name });

        // Herkes elindiyse
        if (room.donePlayers.size >= room.players.length) {
          clearInterval(room.timerInt);
          io.to(room.code).emit('round_result', {
            win: false,
            winnerId: null,
            winnerName: null,
            pts: 0,
            answer: room.curPlayer.n,
            players: room.players,
          });
          room.state = 'result';
        }
      } else {
        socket.emit('wrong_guess', { remaining, hintsOpen: room.hintsOpen });
      }
    }
  });

  // Next round (host)
  socket.on('next_round', () => {
    const room = rooms[socket.roomCode];
    if (!room || socket.id !== room.host) return;
    room.round++;
    const total = room.totalRounds || 7;
    if (room.round >= total) {
      room.state = 'final';
      io.to(room.code).emit('game_final', { players: room.players });
    } else {
      room.state = 'playing';
      startRound(room);
    }
  });

  // Play again (host)
  socket.on('play_again', () => {
    const room = rooms[socket.roomCode];
    if (!room || socket.id !== room.host) return;
    room.players.forEach(p => p.score = 0);
    room.round = 0;
    room.usedPlayers = [];
    room.state = 'playing';
    // keep same totalRounds
    startRound(room);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const code = socket.roomCode;
    if (!code || !rooms[code]) return;
    const room = rooms[code];
    const leavingPlayer = room.players.find(p => p.id === socket.id);
    const leavingName = leavingPlayer ? leavingPlayer.name : 'Bir oyuncu';
    room.players = room.players.filter(p => p.id !== socket.id);
    if (room.players.length === 0) {
      clearInterval(room.timerInt);
      delete rooms[code];
    } else {
      if (room.host === socket.id) room.host = room.players[0].id;
      clearInterval(room.timerInt); // stop the game
      io.to(code).emit('player_left', { name: leavingName });
      // Clean up room
      setTimeout(() => { delete rooms[code]; }, 5000);
    }
  });
});

function startRound(room) {
  // Pick player
  let avail = DB.filter(p => !room.usedPlayers.includes(p.n));
  if (!avail.length) { room.usedPlayers = []; avail = DB; }
  const sh = shuffle(avail);
  room.curPlayer = sh[0];
  room.usedPlayers.push(sh[0].n);
  room.hintsOpen = 0;
  room.wrongPerPlayer = {};
  room.donePlayers = new Set();
  room.solved = false;

  const clues = buildClues(room.curPlayer);

  // Broadcast round start
  io.to(room.code).emit('round_start', {
    round: room.round,
    totalRounds: room.totalRounds || 7,
    clues: {
      always: clues.always,
      hintsCount: clues.hints.length,
    },
    players: room.players,
  });

  // Start timer
  room.timerLeft = 30;
  clearInterval(room.timerInt);
  room.timerInt = setInterval(() => {
    room.timerLeft--;
    io.to(room.code).emit('timer_tick', { left: room.timerLeft });
    if (room.timerLeft <= 0) {
      clearInterval(room.timerInt);
      if (room.state === 'playing' && !room.solved) {
        io.to(room.code).emit('round_result', {
          win: false,
          winnerId: null,
          pts: 0,
          answer: room.curPlayer.n,
          players: room.players,
        });
        room.state = 'result';
      }
    }
  }, 1000);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Futbolcu Kim server on port', PORT));
