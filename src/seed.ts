import type { BuyCat, CheckItem, Diet, Item, PlaceCat, Traveler, Trip } from './types'

// Dati iniziali presi dalla mappa XMind "HoneyMoon - Japan" e dal file "Budget Luna di Miele.xlsx".
export const START = '2027-06-23'
export const END = '2027-07-15'
export const TRAVELERS: Traveler[] = [{ id: 't1', name: 'Edoardo' }, { id: 't2', name: 'Secondo viaggiatore' }]

const SKY = 'https://www.skyscanner.it/trasporti/voli/'
const TRIPCOM = 'https://www.trip.com/hotels/detail/?curr=EUR&adult=2&hotelId='
const eur = (cost: number, paid = false) => ({ cost, currency: 'EUR', paid })

/** Voli, alloggi, trasporti, esperienze e spese dal foglio Excel. Id fissi, così la migrazione non li duplica. */
export function sheetItems(): Item[] {
  let k = 0
  const x = () => 'x' + ++k
  const qatar = { personal: 1, cabin: 1, hold: 1, holdKg: 25 }
  const ana = { cabin: 1, hold: 1, holdKg: 23 }
  const tr = (date: string, title: string, mode: Item['mode'], cost: number, notes: string, extra: Partial<Item> = {}): Item =>
    ({ id: x(), kind: 'transport', title, mode, date, notes, ...eur(cost), ...extra })
  const exp = (title: string, cityId: string | undefined, cost: number, extra: Partial<Item> = {}): Item =>
    ({ id: x(), kind: 'place', placeCat: 'experience', title, cityId, ...eur(cost), ...extra })
  const other = (title: string, cost: number, expenseCat: Item['expenseCat'], notes?: string): Item =>
    ({ id: x(), kind: 'expense', title, expenseCat, notes, ...eur(cost) })
  return [
    // voli
    { id: x(), kind: 'flight', title: 'Roma → Tokyo', from: 'FCO', to: 'NRT', date: START, time: '09:40', endDate: '2027-06-24', endTime: '12:55',
      stops: [{ place: 'Doha', duration: '4h 30m' }], duration: '20h 15m', ref: 'Qatar Airways', bags: qatar, ...eur(1474),
      link: SKY + 'rome/tyoa/270623/270715/?adultsv2=2&cabinclass=economy', notes: 'Prezzo di andata e ritorno per 2 persone.' },
    { id: x(), kind: 'flight', title: 'Tokyo → Roma', from: 'HND', to: 'FCO', date: END, time: '01:25', endDate: END, endTime: '14:15',
      stops: [{ place: 'Doha', duration: '2h 35m' }], duration: '19h 50m', ref: 'Qatar Airways', bags: qatar,
      link: SKY + 'rome/tyoa/270623/270715/?adultsv2=2&cabinclass=economy', notes: 'Il prezzo è compreso nel volo di andata.' },
    { id: x(), kind: 'flight', title: 'Osaka → Miyakojima', from: 'ITM', to: 'MMY', date: '2027-07-08', time: '14:05', endDate: '2027-07-08', endTime: '17:50',
      stops: [{ place: 'Naha', duration: '40m' }], duration: '3h 45m', ref: 'ANA', bags: ana, ...eur(189), link: SKY + 'osaa/jmmy/270708/?adultsv2=2&cabinclass=economy&rtn=0' },
    { id: x(), kind: 'flight', title: 'Miyakojima → Tokyo', from: 'MMY', to: 'HND', date: '2027-07-14', time: '11:45', endDate: '2027-07-14', endTime: '14:25',
      stops: [], duration: '2h 40m', ref: 'ANA', bags: ana, ...eur(200), link: SKY + 'jmmy/hnd/270714/?adultsv2=2&cabinclass=economy&rtn=0', notes: 'Volo diretto.' },
    // alloggi
    { id: x(), kind: 'stay', title: 'Hotel a Tokyo', cityId: 'tokyo', date: '2027-06-24', endDate: '2027-06-30', ...eur(644), bookingNeeded: true, booked: true, link: TRIPCOM + '994521', notes: 'Prenotato su Trip.com.' },
    { id: x(), kind: 'stay', title: 'Hotel a Kyoto', cityId: 'kyoto', date: '2027-06-30', endDate: '2027-07-04', ...eur(185), bookingNeeded: true, booked: true, link: TRIPCOM + '63339229', notes: 'Prenotato su Trip.com.' },
    { id: x(), kind: 'stay', title: 'Hotel a Osaka', cityId: 'osaka', date: '2027-07-04', endDate: '2027-07-08', ...eur(188), bookingNeeded: true, booked: true, link: TRIPCOM + '106750501', notes: 'Prenotato su Trip.com.' },
    { id: x(), kind: 'stay', title: 'Hotel a Miyakojima', cityId: 'miyako', date: '2027-07-08', endDate: '2027-07-14', ...eur(2042), bookingNeeded: true, booked: false, link: TRIPCOM + '133079681', notes: 'Trovato su Trip.com, ancora da prenotare.' },
    // trasporti
    tr('2027-06-24', 'Narita → hotel', 'train', 35, 'Skyliner, poi Oedo line.', { from: 'NRT', to: 'Hotel a Tokyo' }),
    tr('2027-06-24', 'Metro e bus a Tokyo', 'metro', 80, 'Stima dal 24/06 al 30/06.'),
    { id: x(), kind: 'pass', title: 'Hakone Freepass', date: '2027-06-27', ...eur(80), notes: 'Andata e ritorno per Hakone da Shinjuku più tutti i trasporti a Hakone.' },
    tr('2027-06-30', 'Tokyo → Kyoto', 'shinkansen', 170, 'Metro, shinkansen e bus. Spediamo i bagagli?', { from: 'Tokyo', to: 'Kyoto' }),
    tr('2027-06-30', 'Metro e bus a Kyoto', 'metro', 50, 'Stima dal 30/06 al 04/07.'),
    tr('2027-07-02', 'Kyoto → Kibune', 'train', 25, 'Andata e ritorno.', { from: 'Kyoto', to: 'Kibune' }),
    tr('2027-07-04', 'Kyoto → Osaka col treno antico', 'train', 10, 'Solo nei weekend e nei giorni festivi.', { from: 'Kyoto', to: 'Osaka' }),
    tr('2027-07-05', 'Metro per Universal', 'metro', 15, 'Osaka - Universal, andata e ritorno.'),
    tr('2027-07-06', 'Osaka → Nara in treno di lusso', 'train', 45, 'Sedili girevoli. Andata e ritorno, non il giovedì.', { from: 'Osaka', to: 'Nara' }),
    tr('2027-07-07', 'Metro e bus a Osaka', 'metro', 30, 'Stima.'),
    tr('2027-07-08', 'Hotel → aeroporto Itami', 'bus', 15, 'Yotsubashi Line, poi Itami Airport Limousine Bus.', { from: 'Hotel a Osaka', to: 'ITM' }),
    tr('2027-07-14', 'Haneda → Tokyo e ritorno', 'train', 30, 'Yamanote Line e Tokyo Monorail. Transfer andata e ritorno l\'ultimo giorno.', { from: 'HND', to: 'Tokyo' }),
    // attrazioni ed esperienze
    exp('Universal Studios Japan', 'osaka', 350, { date: '2027-07-05', notes: 'Con Express Pass 5. Oppure 400 € con Express Pass 8 (prezzi ipotetici, sempre variabili).' }),
    exp('Round1', undefined, 100, { notes: 'Prezzo fisso per 3 ore di attività diverse. Giochi arcade da 1 a 2 €, biliardo e bowling a parte.' }),
    exp('Crociera al tramonto', 'miyako', 70),
    exp('Snorkeling', 'miyako', 90),
    exp('Marble', undefined, 30),
    exp('Bici elettrica', undefined, 70, { notes: 'Noleggio per circa 6 ore.' }),
    exp('teamLab', 'tokyo', 60),
    exp('Shibuya Sky', 'tokyo', 40, { placeCat: 'sight' }),
    exp('Tokyo Go Kart', 'tokyo', 200),
    exp('Seggiovia', 'kyoto', 15),
    exp('Noleggio kimono e cerimonia del tè', 'kyoto', 100),
    // altre spese
    other('Cibo per 2 persone', 1600, 'food', 'Stima approssimativa per tutto il viaggio.'),
    other('Assicurazione viaggio', 135, 'other'),
    other('Tasse di soggiorno', 150, 'other'),
    other('eSIM', 50, 'other', '20 GB a testa.'),
  ]
}
let n = 0
const id = () => 's' + ++n

const place = (cityId: string, placeCat: PlaceCat, title: string, extra: Partial<Item> = {}): Item => ({
  id: id(), kind: 'place', cityId, placeCat, title, ...extra,
})
const food = (cityId: string, title: string, diet: Diet | undefined, extra: Partial<Item> = {}) =>
  place(cityId, 'food', title, { diet, ...extra })
const buy = (buyCat: BuyCat, title: string, store?: string, notes?: string, cityId?: string): Item => ({
  id: id(), kind: 'buy', buyCat, title, store, notes, cityId,
})


export function seedTrips(): Trip[] {
  n = 0
  const start = START
  const end = END

  const items: Item[] = [
    ...sheetItems(),

    // --- Tokyo ---
    place('tokyo', 'sight', 'Senkyakubanrai Ashiyu Garden', { area: '8° piano', notes: 'Grattacielo con bagno per i piedi gratuito e vista oceano.' }),
    food('tokyo', 'TsuruTonTan', 'options', { area: 'Shibuya Scramble Square, 13° piano', notes: 'Noodles e udon. Pare abbiano opzioni vegetariane, ma attenzione al dashi.' }),
    food('tokyo', 'Masaka', 'vegan', { area: 'Shibuya PARCO, B1F', notes: 'Izakaya vegana.' }),
    food('tokyo', "T's TanTan", 'vegan', { area: 'Tokyo Station (dentro la stazione)', notes: 'Ramen e tantanmen.' }),
    food('tokyo', 'Komeda Is', 'vegan', { area: 'Higashi-Ginza', address: '1-20-13 Tsukiji' }),
    food('tokyo', 'Vegan Bistro Jangara', 'vegan', { area: 'Harajuku', address: '1-14-2 Jingumae' }),
    food('tokyo', 'Vegan Gyoza', 'vegan', { area: 'Ueno / Negishi', address: '3-11-17 Negishi' }),
    food('tokyo', 'Vegan Sushi Tokyo', 'vegan'),
    food('tokyo', 'Tokyo Vegan Ramen Center', 'vegan'),
    food('tokyo', 'Engine Ramen', 'options', { notes: 'Hanno il ramen vegano (anche a Osaka).' }),
    food('tokyo', 'Kyushu Jangara', 'options', { notes: 'Hanno due ramen vegani.' }),
    food('tokyo', 'Zen', undefined, { area: 'Shinjuku' }),
    food('tokyo', 'Ippudo', 'options', { area: 'Shinjuku' }),
    food('tokyo', 'Torcia', undefined, { area: 'Shinjuku', notes: 'Sembra italiano dalla descrizione, non dalle foto. Molto sofisticato.' }),
    place('tokyo', 'cafe', 'Ruru Shibuya', { area: 'Shibuya', notes: 'Water table café.' }),
    place('tokyo', 'cafe', 'Cloud Club Matcha'),
    place('tokyo', 'sweets', 'Excelsior Caffè', { notes: 'Gelato e non solo.' }),
    place('tokyo', 'market', 'Good Nature Station', { diet: 'options', notes: 'Cibo confezionato e fatto al momento (hamburger veg). Forse dentro un centro commerciale.' }),
    place('tokyo', 'bar', 'Bar Centifolia', { closed: 'mercoledì', bookingNeeded: true, notes: 'Cocktail scenografici. Serve prenotazione e costa parecchio.' }),

    // --- Kyoto ---
    food('kyoto', 'Vegan Ramen UZU Kyoto', 'vegan', { area: 'Kamigyo', address: '146 Umezoyacho' }),
    food('kyoto', 'Shigetsu', 'vegan', { area: 'Arashiyama', address: 'Dentro il tempio Tenryu-ji', notes: 'Shojin ryori, cucina buddista.' }),
    food('kyoto', 'Mumokuteki Cafe & Foods', 'vegetarian', { area: 'Kawaramachi', address: '261-1 Bldg 2F' }),
    food('kyoto', 'Ain Soph. Journey Kyoto', 'vegan', { area: 'Nakagyo', address: '538-6 Nakanocho' }),
    food('kyoto', 'Gion Soy Milk Ramen Uno Yukiko', 'options', { area: 'Gion', address: '570-264 Gionmachi' }),
    food('kyoto', 'Hirobun', undefined, { area: 'Kibune', notes: 'Nagashi somen, i noodles che scorrono nel bambù.' }),
    food('kyoto', 'VegOut', 'vegan', { notes: 'Pranzo e colazione.' }),
    food('kyoto', 'Kyoto Bien', 'vegan', { notes: 'Ramen e pranzo.' }),
    food('kyoto', 'Tu Casa', 'vegan', { notes: 'Plant based, zero waste. Bowls, cena.' }),

    // --- Osaka ---
    food('osaka', 'Mizuno', 'options', { area: 'Dotonbori', address: '1-4-15 Dotonbori', notes: 'Premiato dalla guida Michelin. Opzioni vegetariane su richiesta, non sono nel menu.' }),
    food('osaka', 'Green Earth', 'vegan', { area: 'Honmachi', address: '4-2-2 Kitakyuhojimachi' }),
    food('osaka', 'Paprika Shokudo Vegan', 'vegan', { area: 'Shinmachi', address: '1-27-9 Shinmachi' }),
    food('osaka', 'Oko Takoyaki', undefined, { area: 'Shinsaibashi', address: '1-15-15 Higashishinsaibashi' }),
    food('osaka', 'Mercy Vegan Factory', 'vegan', { area: 'Tanimachi', address: '2-4-15 Kawarayamachi' }),
    food('osaka', 'Engine Ramen', 'options', { notes: 'Hanno il ramen vegano (anche a Tokyo).' }),
    food('osaka', 'Aju', undefined, { area: 'Nakazakicho', address: '1-10-14 Nakazakinishi' }),
    place('osaka', 'cafe', 'Inception Osaka', { notes: 'Servono il matcha nel cubo di ghiaccio.' }),
    place('osaka', 'sweets', 'Grenier Patisserie', { area: 'Kitahama', notes: 'Crème brûlée puff e strawberry cream puff. 5 minuti da Dotonbori.' }),

    // --- da comprare / assaggiare ---
    buy('sweet', 'Fluffy pancakes'),
    buy('sweet', 'Japanese cheesecake'),
    buy('sweet', 'Dojima Roll'),
    buy('sweet', 'Crème brûlée puff', 'Grenier Patisserie', 'Anche la strawberry cream puff.', 'osaka'),
    buy('drink', 'Coca-Cola Plus'),
    buy('drink', 'Pocari Sweat'),
    buy('drink', 'Suntory Tokusui'),
    buy('drink', 'Bevande che fanno dimagrire'),
    buy('savory', 'Onigiri alla prugna', '7-Eleven'),
    buy('savory', 'Tramezzini all\'uovo', '7-Eleven'),
    buy('drink', 'Frullati di frutta', '7-Eleven'),
    buy('sweet', 'Brûlée', '7-Eleven'),
    buy('care', 'Fibe Mini', '7-Eleven', 'Per il jet lag, aiuta la digestione.'),
    buy('care', 'Night Recover', '7-Eleven', 'Per il jet lag, per dormire meglio.'),
    buy('care', 'Vitamina D da bere', '7-Eleven', 'Per il jet lag. È una bottiglietta.'),
    buy('care', 'Chocola BB Sparkling', '7-Eleven', 'Per il jet lag, glow up della pelle.'),
    buy('care', 'Vitamina C boost', '7-Eleven', 'Per il jet lag, energia.'),
    buy('sweet', 'Melon Pan', 'FamilyMart'),
    buy('sweet', 'Gelato tiramisù al matcha', 'FamilyMart'),
    buy('drink', 'Frappè tè e latte', 'FamilyMart'),
    buy('sweet', 'Rotoli di torta al mochi', 'Lawson'),
    buy('sweet', 'Kouign Amann', 'Lawson', 'Sfoglia a strati di burro e zucchero.'),
    buy('drink', 'Matcha latte', 'Lawson'),
    buy('other', 'Prodotti Muji', 'Lawson'),
    buy('other', 'Fare un giro da Natural Lawson', 'Natural Lawson', 'Ci sono dappertutto, ma più facili da trovare a Tokyo.', 'tokyo'),
    buy('sweet', 'Gelato al latte di Hokkaido', 'Ministop'),
    buy('sweet', 'Halo Halo', 'Ministop', 'Granita con frutta e gelato.'),
    buy('sweet', 'Parfait', 'Ministop', 'Dolce al cucchiaio.'),
    buy('savory', 'Cibo pronto per la sera', 'Supermercati', 'AEON, Maruetsu, Life, Seiyu: più varietà, prezzi più bassi e tanto cibo già pronto.'),
  ]

  const check = (group: CheckItem['group'], text: string, due?: string): CheckItem => ({ id: id(), group, text, due })
  const checklist = [
    check('prima', 'Controllare la scadenza del passaporto'),
    check('prima', 'Registrarsi su Visit Japan Web (QR per immigrazione e dogana)', '2027-06-16'),
    check('prima', 'Assicurazione di viaggio'),
    check('prima', 'eSIM o pocket Wi-Fi'),
    check('prima', 'Aggiungere la Suica al Wallet dell\'iPhone'),
    check('prima', 'Portare yen in contanti, tanti posti accettano solo contanti'),
    check('prima', 'Carta senza commissioni sui pagamenti esteri'),
    check('prima', 'Valutare se conviene il JR Pass'),
    check('prima', 'Scaricare le mappe offline su Google Maps'),
    check('prima', 'Museo Ghibli: biglietti in vendita il 10 del mese prima', '2027-05-10'),
    check('valigia', 'Passaporto (serve anche per il tax free)'),
    check('valigia', 'Adattatore presa tipo A'),
    check('valigia', 'Powerbank'),
    check('valigia', 'Scarpe comode'),
    check('valigia', 'Asciugamano piccolo, molti bagni pubblici non ne hanno'),
    check('valigia', 'Sacchetto per i rifiuti, in giro ci sono pochi cestini'),
  ]

  return [
    {
      id: 'giappone-2027',
      name: 'Giappone',
      start,
      end,
      currency: 'JPY',
      cities: [
        { id: 'tokyo', name: 'Tokyo' },
        { id: 'kyoto', name: 'Kyoto' },
        { id: 'osaka', name: 'Osaka' },
        { id: 'miyako', name: 'Miyakojima' },
      ],
      travelers: TRAVELERS,
      budget: 10000,
      items,
      checklist,
      docs: [],
    },
  ]
}
