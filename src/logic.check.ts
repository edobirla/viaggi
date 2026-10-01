// Esegui con: node src/logic.check.ts
import assert from 'node:assert/strict'
import { cmp, convert, deadlines, parseBaggage, stayTax, totals } from './util.ts'
import { km, nearestOrder } from './geo.ts'
import type { Trip } from './types.ts'

// senza orario va dopo gli orari; il check-in ('~~') dopo gli elementi ordinati ('~001')
assert.deepEqual(['~~', '~001', '09:40', '~999'].sort(cmp), ['09:40', '~001', '~999', '~~'])

// Roma - Tokyo circa 9.860 km
const rome: [number, number] = [41.8, 12.25], tokyo: [number, number] = [35.76, 140.39]
assert.ok(Math.abs(km(rome, tokyo) - 9860) < 100)

// percorso: parte dall'hotel e va sempre al più vicino
const hotel: [number, number] = [0, 0]
const route = nearestOrder([{ id: 'far', pos: [0, 3] as [number, number] }, { id: 'none' }, { id: 'near', pos: [0, 1] as [number, number] }], hotel)
assert.deepEqual(route.map((x) => x.id), ['near', 'far', 'none'])

const rates = { base: 'EUR', date: '', rates: { EUR: 1, JPY: 180 } }
assert.equal(convert(1800, 'JPY', 'EUR', rates), 10)
assert.equal(convert(10, 'USD', 'EUR', rates), null)

const t: Trip = {
  id: 'x', name: 'x', start: '2027-06-23', end: '2027-07-15', currency: 'JPY', travelers: [], cities: [], docs: [],
  items: [
    { id: 'f', kind: 'flight', title: 'Volo', cost: 100, baggageCost: 50, currency: 'EUR', paid: true },
    { id: 'e', kind: 'expense', title: 'Stima cibo', cost: 1800, currency: 'JPY' }, // spesa non pagata
    { id: 'u', kind: 'place', title: 'Senza cambio', cost: 5, currency: 'USD' },
    { id: 'b', kind: 'place', title: 'Bar', bookingNeeded: true, bookingOpens: '2027-05-10' },
  ],
  checklist: [{ id: 'k', group: 'prima', text: 'Visit Japan Web', due: '2027-06-16' }],
}
const tot = totals(t, 'EUR', rates)
assert.equal(tot.planned, 160) // volo + bagagli + cibo convertito
assert.equal(tot.paid, 150)
assert.equal(tot.unconverted, 1)
assert.equal(tot.byCat.flights, 150)
assert.deepEqual(deadlines(t).map((d) => d.id), ['b', 'k'])
// tassa di soggiorno: 200 ¥ × 2 persone × 6 notti = 2.400 ¥ = 13,33 €, conteggiata a parte nel budget
const t2: Trip = { ...t, travelers: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], items: [
  { id: 's', kind: 'stay', title: 'Hotel', date: '2027-06-24', endDate: '2027-06-30', tax: 200, taxCurrency: 'JPY' },
] }
assert.equal(stayTax(t2.items[0], t2)?.total, 2400)
assert.ok(Math.abs(totals(t2, 'EUR', rates).byCat.taxes - 13.33) < 0.01)

assert.deepEqual(parseBaggage('1 piccolo bagaglio personale, 1 bagaglio a mano, 1 bagaglio da stiva (25kg)'), { personal: 1, cabin: 1, hold: 1, holdKg: 25 })
console.log('logica ok')
