// What the tick domain's fixed cards are called and what they do: the line and what the board says on it (a task's
// inputs and outputs are the base's own cards, its parts a game's parts.json). A description says only what a card does
// (games/design/README.md 4).
import { Activity, Megaphone } from 'lucide-react'
import { fixedCards } from '../core/cards.js'

export const CARDS = {
  line: { ...fixedCards.line, icon: Activity },
  say: { ...fixedCards.say, icon: Megaphone },
}
