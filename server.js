const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Set permissive CSP for Socket.io to work
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
    "script-src * 'unsafe-inline' 'unsafe-eval'; " +
    "connect-src * ws: wss:; " +
    "style-src * 'unsafe-inline';"
  );
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
  {n:"Lionel Messi",f:"AR",c:"Arjantin",age:37,pos:"Sag Kanat",foot:"Sol",h:170,w:72,val:"30M",club:"Inter Miami",no:10,lig:"MLS"},
  {n:"Cristiano Ronaldo",f:"PT",c:"Portekiz",age:39,pos:"Forvet",foot:"Sag",h:187,w:85,val:"15M",club:"Al Nassr",no:7,lig:"Saudi Pro Ligi"},
  {n:"Erling Haaland",f:"NO",c:"Norvec",age:24,pos:"Santrfor",foot:"Sol",h:194,w:88,val:"180M",club:"Manchester City",no:9,lig:"Premier Lig"},
  {n:"Kylian Mbappe",f:"FR",c:"Fransa",age:26,pos:"Forvet",foot:"Sag",h:178,w:73,val:"180M",club:"Real Madrid",no:9,lig:"La Liga"},
  {n:"Vinicius Jr",f:"BR",c:"Brezilya",age:24,pos:"Sol Kanat",foot:"Sag",h:176,w:73,val:"180M",club:"Real Madrid",no:7,lig:"La Liga"},
  {n:"Lamine Yamal",f:"ES",c:"Ispanya",age:17,pos:"Sag Kanat",foot:"Sol",h:180,w:65,val:"180M",club:"Barcelona",no:19,lig:"La Liga"},
  {n:"Jude Bellingham",f:"EN",c:"Ingiltere",age:21,pos:"Merkez MF",foot:"Sag",h:186,w:83,val:"180M",club:"Real Madrid",no:5,lig:"La Liga"},
  {n:"Mohamed Salah",f:"EG",c:"Misir",age:32,pos:"Sag Kanat",foot:"Sol",h:175,w:71,val:"60M",club:"Liverpool",no:11,lig:"Premier Lig"},
  {n:"Harry Kane",f:"EN",c:"Ingiltere",age:31,pos:"Santrfor",foot:"Sag",h:188,w:86,val:"80M",club:"Bayern Munih",no:9,lig:"Bundesliga"},
  {n:"Bukayo Saka",f:"EN",c:"Ingiltere",age:23,pos:"Sag Kanat",foot:"Sol",h:178,w:72,val:"150M",club:"Arsenal",no:7,lig:"Premier Lig"},
  {n:"Phil Foden",f:"EN",c:"Ingiltere",age:24,pos:"Attacking MF",foot:"Sol",h:171,w:70,val:"150M",club:"Manchester City",no:47,lig:"Premier Lig"},
  {n:"Florian Wirtz",f:"DE",c:"Almanya",age:21,pos:"Attacking MF",foot:"Sag",h:176,w:70,val:"150M",club:"Bayer Leverkusen",no:10,lig:"Bundesliga"},
  {n:"Jamal Musiala",f:"DE",c:"Almanya",age:21,pos:"Attacking MF",foot:"Sol",h:183,w:70,val:"150M",club:"Bayern Munih",no:42,lig:"Bundesliga"},
  {n:"Cole Palmer",f:"EN",c:"Ingiltere",age:22,pos:"Attacking MF",foot:"Sag",h:185,w:76,val:"100M",club:"Chelsea",no:20,lig:"Premier Lig"},
  {n:"Martin Odegaard",f:"NO",c:"Norvec",age:26,pos:"Attacking MF",foot:"Sag",h:178,w:68,val:"110M",club:"Arsenal",no:8,lig:"Premier Lig"},
  {n:"Rodri",f:"ES",c:"Ispanya",age:28,pos:"Def MF",foot:"Sag",h:191,w:82,val:"120M",club:"Manchester City",no:16,lig:"Premier Lig"},
  {n:"Kevin De Bruyne",f:"BE",c:"Belcika",age:33,pos:"Attacking MF",foot:"Sag",h:181,w:70,val:"40M",club:"Manchester City",no:17,lig:"Premier Lig"},
  {n:"Pedri",f:"ES",c:"Ispanya",age:22,pos:"Merkez MF",foot:"Sag",h:174,w:60,val:"100M",club:"Barcelona",no:8,lig:"La Liga"},
  {n:"Raphinha",f:"BR",c:"Brezilya",age:28,pos:"Sag Kanat",foot:"Sol",h:176,w:68,val:"80M",club:"Barcelona",no:11,lig:"La Liga"},
  {n:"Federico Valverde",f:"UY",c:"Uruguay",age:26,pos:"Merkez MF",foot:"Sag",h:182,w:78,val:"120M",club:"Real Madrid",no:8,lig:"La Liga"},
  {n:"Lautaro Martinez",f:"AR",c:"Arjantin",age:27,pos:"Santrfor",foot:"Sag",h:174,w:72,val:"110M",club:"Inter Milan",no:10,lig:"Serie A"},
  {n:"Victor Osimhen",f:"NG",c:"Nijerya",age:26,pos:"Santrfor",foot:"Sag",h:185,w:78,val:"75M",club:"Galatasaray",no:9,lig:"Super Lig"},
  {n:"Khvicha Kvaratskhelia",f:"GE",c:"Grcistan",age:24,pos:"Sol Kanat",foot:"Sag",h:183,w:74,val:"80M",club:"PSG",no:77,lig:"Ligue 1"},
  {n:"Rafael Leao",f:"PT",c:"Portekiz",age:25,pos:"Sol Kanat",foot:"Sag",h:188,w:78,val:"80M",club:"AC Milan",no:10,lig:"Serie A"},
  {n:"Arda Guler",f:"TR",c:"Turkiye",age:20,pos:"Attacking MF",foot:"Sol",h:176,w:65,val:"60M",club:"Real Madrid",no:24,lig:"La Liga"},
  {n:"Hakan Calhanoglu",f:"TR",c:"Turkiye",age:31,pos:"Def MF",foot:"Sol",h:179,w:78,val:"35M",club:"Inter Milan",no:20,lig:"Serie A"},
  {n:"Kenan Yildiz",f:"TR",c:"Turkiye",age:20,pos:"Sol Kanat",foot:"Sag",h:183,w:73,val:"30M",club:"Juventus",no:10,lig:"Serie A"},
  {n:"Antoine Griezmann",f:"FR",c:"Fransa",age:33,pos:"Forvet",foot:"Sol",h:176,w:73,val:"25M",club:"Atletico Madrid",no:7,lig:"La Liga"},
  {n:"Robert Lewandowski",f:"PL",c:"Polonya",age:36,pos:"Santrfor",foot:"Sag",h:185,w:80,val:"15M",club:"Barcelona",no:9,lig:"La Liga"},
  {n:"Neymar Jr",f:"BR",c:"Brezilya",age:33,pos:"Sol Kanat",foot:"Sag",h:175,w:68,val:"20M",club:"Al Hilal",no:10,lig:"Saudi Pro Ligi"},
  {n:"Son Heung-min",f:"KR",c:"Guney Kore",age:32,pos:"Sol Kanat",foot:"Sol",h:183,w:78,val:"35M",club:"Tottenham",no:7,lig:"Premier Lig"},
  {n:"Marcus Rashford",f:"EN",c:"Ingiltere",age:27,pos:"Sol Kanat",foot:"Sag",h:180,w:70,val:"40M",club:"Aston Villa",no:10,lig:"Premier Lig"},
  {n:"Romelu Lukaku",f:"BE",c:"Belcika",age:31,pos:"Santrfor",foot:"Sag",h:191,w:94,val:"20M",club:"Napoli",no:11,lig:"Serie A"},
  {n:"Bernardo Silva",f:"PT",c:"Portekiz",age:30,pos:"Attacking MF",foot:"Sag",h:173,w:64,val:"70M",club:"Manchester City",no:20,lig:"Premier Lig"},
  {n:"Trent Alexander-Arnold",f:"EN",c:"Ingiltere",age:26,pos:"Sag Bek",foot:"Sag",h:175,w:69,val:"80M",club:"Real Madrid",no:66,lig:"La Liga"},
  {n:"Ruben Dias",f:"PT",c:"Portekiz",age:27,pos:"Stoper",foot:"Sag",h:187,w:76,val:"80M",club:"Manchester City",no:3,lig:"Premier Lig"},
  {n:"Virgil van Dijk",f:"NL",c:"Hollanda",age:33,pos:"Stoper",foot:"Sag",h:193,w:92,val:"40M",club:"Liverpool",no:4,lig:"Premier Lig"},
  {n:"Gianluigi Donnarumma",f:"IT",c:"Italya",age:26,pos:"Kaleci",foot:"Sol",h:196,w:90,val:"60M",club:"PSG",no:99,lig:"Ligue 1"},
  {n:"Alisson Becker",f:"BR",c:"Brezilya",age:32,pos:"Kaleci",foot:"Sag",h:193,w:91,val:"40M",club:"Liverpool",no:1,lig:"Premier Lig"},
  {n:"Jonathan David",f:"CA",c:"Kanada",age:24,pos:"Santrfor",foot:"Sag",h:178,w:74,val:"65M",club:"Lille",no:9,lig:"Ligue 1"},
  {n:"Ademola Lookman",f:"NG",c:"Nijerya",age:27,pos:"Sol Kanat",foot:"Sag",h:175,w:70,val:"55M",club:"Atalanta",no:11,lig:"Serie A"},
  {n:"Achraf Hakimi",f:"MA",c:"Fas",age:26,pos:"Sag Bek",foot:"Sag",h:181,w:73,val:"70M",club:"PSG",no:2,lig:"Ligue 1"},
  {n:"Theo Hernandez",f:"FR",c:"Fransa",age:27,pos:"Sol Bek",foot:"Sol",h:184,w:84,val:"65M",club:"AC Milan",no:19,lig:"Serie A"},
  {n:"Declan Rice",f:"EN",c:"Ingiltere",age:26,pos:"Def MF",foot:"Sag",h:185,w:82,val:"100M",club:"Arsenal",no:41,lig:"Premier Lig"},
  {n:"Karim Benzema",f:"FR",c:"Fransa",age:36,pos:"Santrfor",foot:"Sag",h:185,w:81,val:"15M",club:"Al Ittihad",no:9,lig:"Saudi Pro Ligi"},
  {n:"Toni Kroos",f:"DE",c:"Almanya",age:34,pos:"Merkez MF",foot:"Sol",h:183,w:76,val:"10M",club:"Real Madrid",no:8,lig:"La Liga"},
  {n:"Luka Modric",f:"HR",c:"Hirvatistan",age:39,pos:"Merkez MF",foot:"Sag",h:172,w:66,val:"5M",club:"Real Madrid",no:10,lig:"La Liga"},
  {n:"N'Golo Kante",f:"FR",c:"Fransa",age:33,pos:"Def MF",foot:"Sag",h:168,w:70,val:"15M",club:"Al Ittihad",no:7,lig:"Saudi Pro Ligi"},
  {n:"Casemiro",f:"BR",c:"Brezilya",age:33,pos:"Def MF",foot:"Sag",h:185,w:84,val:"20M",club:"Man United",no:18,lig:"Premier Lig"},
  {n:"Thomas Muller",f:"DE",c:"Almanya",age:35,pos:"Forvet",foot:"Sag",h:186,w:75,val:"5M",club:"Bayern Munih",no:25,lig:"Bundesliga"},
  {n:"Leroy Sane",f:"DE",c:"Almanya",age:28,pos:"Sol Kanat",foot:"Sag",h:183,w:75,val:"40M",club:"Bayern Munih",no:10,lig:"Bundesliga"},
  {n:"Joshua Kimmich",f:"DE",c:"Almanya",age:29,pos:"Sag Bek/MF",foot:"Sag",h:177,w:75,val:"60M",club:"Bayern Munih",no:6,lig:"Bundesliga"},
  {n:"Alphonso Davies",f:"CA",c:"Kanada",age:24,pos:"Sol Bek",foot:"Sol",h:183,w:63,val:"70M",club:"Bayern Munih",no:19,lig:"Bundesliga"},
  {n:"Manuel Neuer",f:"DE",c:"Almanya",age:38,pos:"Kaleci",foot:"Sag",h:193,w:92,val:"5M",club:"Bayern Munih",no:1,lig:"Bundesliga"},
  {n:"Jan Oblak",f:"SI",c:"Slovenya",age:31,pos:"Kaleci",foot:"Sag",h:188,w:87,val:"30M",club:"Atletico Madrid",no:13,lig:"La Liga"},
  {n:"Ederson",f:"BR",c:"Brezilya",age:31,pos:"Kaleci",foot:"Sol",h:188,w:86,val:"35M",club:"Manchester City",no:31,lig:"Premier Lig"},
  {n:"David Raya",f:"ES",c:"Ispanya",age:29,pos:"Kaleci",foot:"Sag",h:183,w:83,val:"35M",club:"Arsenal",no:22,lig:"La Liga"},
  {n:"Dani Carvajal",f:"ES",c:"Ispanya",age:32,pos:"Sag Bek",foot:"Sag",h:173,w:73,val:"20M",club:"Real Madrid",no:2,lig:"La Liga"},
  {n:"Antonio Rudiger",f:"DE",c:"Almanya",age:31,pos:"Stoper",foot:"Sag",h:190,w:85,val:"30M",club:"Real Madrid",no:22,lig:"La Liga"},
  {n:"William Saliba",f:"FR",c:"Fransa",age:23,pos:"Stoper",foot:"Sag",h:192,w:91,val:"80M",club:"Arsenal",no:12,lig:"Premier Lig"},
  {n:"Lisandro Martinez",f:"AR",c:"Arjantin",age:26,pos:"Stoper",foot:"Sol",h:175,w:76,val:"55M",club:"Man United",no:6,lig:"Premier Lig"},
  {n:"Jules Kounde",f:"FR",c:"Fransa",age:26,pos:"Sag Bek",foot:"Sag",h:178,w:75,val:"60M",club:"Barcelona",no:23,lig:"La Liga"},
  {n:"Pau Cubarsi",f:"ES",c:"Ispanya",age:18,pos:"Stoper",foot:"Sol",h:184,w:77,val:"60M",club:"Barcelona",no:3,lig:"La Liga"},
  {n:"Gavi",f:"ES",c:"Ispanya",age:22,pos:"Merkez MF",foot:"Sol",h:173,w:60,val:"80M",club:"Barcelona",no:6,lig:"La Liga"},
  {n:"Frenkie de Jong",f:"NL",c:"Hollanda",age:27,pos:"Merkez MF",foot:"Sag",h:180,w:74,val:"45M",club:"Barcelona",no:21,lig:"La Liga"},
  {n:"Nicolo Barella",f:"IT",c:"Italya",age:27,pos:"Merkez MF",foot:"Sag",h:172,w:68,val:"80M",club:"Inter Milan",no:23,lig:"Serie A"},
  {n:"Marcus Thuram",f:"FR",c:"Fransa",age:27,pos:"Santrfor",foot:"Sag",h:192,w:85,val:"55M",club:"Inter Milan",no:9,lig:"Serie A"},
  {n:"Mike Maignan",f:"FR",c:"Fransa",age:29,pos:"Kaleci",foot:"Sag",h:191,w:83,val:"50M",club:"AC Milan",no:16,lig:"Serie A"},
  {n:"Ousmane Dembele",f:"FR",c:"Fransa",age:27,pos:"Sag Kanat",foot:"Sol",h:178,w:67,val:"60M",club:"PSG",no:10,lig:"Ligue 1"},
  {n:"Bradley Barcola",f:"FR",c:"Fransa",age:22,pos:"Sol Kanat",foot:"Sag",h:180,w:70,val:"70M",club:"PSG",no:29,lig:"Ligue 1"},
  {n:"Goncalo Ramos",f:"PT",c:"Portekiz",age:23,pos:"Santrfor",foot:"Sag",h:187,w:79,val:"60M",club:"PSG",no:9,lig:"Ligue 1"},
  {n:"Sadio Mane",f:"SN",c:"Senegal",age:32,pos:"Sol Kanat",foot:"Sag",h:175,w:69,val:"15M",club:"Al Nassr",no:10,lig:"Saudi Pro Ligi"},
  {n:"Ciro Immobile",f:"IT",c:"Italya",age:34,pos:"Santrfor",foot:"Sag",h:185,w:80,val:"8M",club:"Besiktas",no:17,lig:"Super Lig"},
  {n:"Mauro Icardi",f:"AR",c:"Arjantin",age:31,pos:"Santrfor",foot:"Sag",h:181,w:77,val:"5M",club:"Galatasaray",no:9,lig:"Super Lig"},
  {n:"Dries Mertens",f:"BE",c:"Belcika",age:37,pos:"Forvet",foot:"Sol",h:169,w:65,val:"3M",club:"Galatasaray",no:14,lig:"Super Lig"},
  {n:"Alvaro Morata",f:"ES",c:"Ispanya",age:32,pos:"Santrfor",foot:"Sag",h:187,w:80,val:"15M",club:"AC Milan",no:7,lig:"Serie A"},
  {n:"Reece James",f:"EN",c:"Ingiltere",age:25,pos:"Sag Bek",foot:"Sag",h:180,w:80,val:"55M",club:"Chelsea",no:24,lig:"Premier Lig"},
  {n:"Ben White",f:"EN",c:"Ingiltere",age:27,pos:"Sag Bek",foot:"Sag",h:186,w:82,val:"60M",club:"Arsenal",no:4,lig:"Premier Lig"},
  {n:"Ferland Mendy",f:"FR",c:"Fransa",age:29,pos:"Sol Bek",foot:"Sol",h:180,w:75,val:"30M",club:"Real Madrid",no:23,lig:"La Liga"},
  {n:"Koke",f:"ES",c:"Ispanya",age:32,pos:"Merkez MF",foot:"Sag",h:176,w:72,val:"15M",club:"Atletico Madrid",no:6,lig:"La Liga"},
  {n:"Kingsley Coman",f:"FR",c:"Fransa",age:28,pos:"Sol Kanat",foot:"Sag",h:181,w:73,val:"45M",club:"Bayern Munih",no:11,lig:"Bundesliga"},
  {n:"Wojciech Szczesny",f:"PL",c:"Polonya",age:34,pos:"Kaleci",foot:"Sol",h:196,w:84,val:"10M",club:"Barcelona",no:25,lig:"La Liga"},
  {n:"Federico Chiesa",f:"IT",c:"Italya",age:27,pos:"Sag Kanat",foot:"Sol",h:175,w:70,val:"25M",club:"Liverpool",no:14,lig:"Premier Lig"},
  {n:"Niclas Fullkrug",f:"DE",c:"Almanya",age:32,pos:"Santrfor",foot:"Sag",h:189,w:88,val:"25M",club:"West Ham",no:11,lig:"Premier Lig"},
  {n:"Fermin Lopez",f:"ES",c:"Ispanya",age:22,pos:"Attacking MF",foot:"Sag",h:172,w:68,val:"45M",club:"Barcelona",no:16,lig:"La Liga"},
  {n:"Dani Olmo",f:"ES",c:"Ispanya",age:26,pos:"Attacking MF",foot:"Sag",h:178,w:70,val:"70M",club:"Barcelona",no:20,lig:"La Liga"},
  {n:"Warren Zaire-Emery",f:"FR",c:"Fransa",age:18,pos:"Merkez MF",foot:"Sag",h:178,w:68,val:"60M",club:"PSG",no:33,lig:"Ligue 1"},
  {n:"Denzel Dumfries",f:"NL",c:"Hollanda",age:28,pos:"Sag Bek",foot:"Sag",h:187,w:85,val:"30M",club:"Inter Milan",no:2,lig:"Serie A"},
  {n:"Tijjani Reijnders",f:"NL",c:"Hollanda",age:26,pos:"Merkez MF",foot:"Sag",h:182,w:75,val:"45M",club:"AC Milan",no:14,lig:"Serie A"},
  {n:"Marc Cucurella",f:"ES",c:"Ispanya",age:26,pos:"Sol Bek",foot:"Sol",h:172,w:68,val:"40M",club:"Chelsea",no:32,lig:"Premier Lig"},
  {n:"Davide Frattesi",f:"IT",c:"Italya",age:25,pos:"Merkez MF",foot:"Sag",h:175,w:70,val:"45M",club:"Inter Milan",no:16,lig:"Serie A"},
  {n:"Diogo Dalot",f:"PT",c:"Portekiz",age:25,pos:"Sag Bek",foot:"Sag",h:183,w:69,val:"45M",club:"Man United",no:20,lig:"Premier Lig"},
  {n:"Eder Militao",f:"BR",c:"Brezilya",age:26,pos:"Stoper",foot:"Sag",h:186,w:77,val:"60M",club:"Real Madrid",no:3,lig:"La Liga"},
  {n:"Ivan Toney",f:"EN",c:"Ingiltere",age:28,pos:"Santrfor",foot:"Sag",h:181,w:78,val:"40M",club:"Al Ahli",no:7,lig:"Saudi Pro Ligi"},
  {n:"Serge Gnabry",f:"DE",c:"Almanya",age:29,pos:"Sag Kanat",foot:"Sol",h:175,w:73,val:"30M",club:"Bayern Munih",no:7,lig:"Bundesliga"},
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

      const wrong = room.wrongPerPlayer[socket.id];
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
