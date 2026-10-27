import { Layers, Plus, Shuffle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SupabaseSetupBanner } from '@/components/app/supabase-setup-banner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import { reviewCard } from '@/lib/spaced-repetition'
import { trySupabase } from '@/lib/supabase/client'
import type { Flashcard, FlashcardDeck } from '@/types/database'

export function FlashcardsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [decks, setDecks] = useState<FlashcardDeck[]>([])
  const [cards, setCards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(true)
  const [deckOpen, setDeckOpen] = useState(false)
  const [cardOpen, setCardOpen] = useState(false)
  const [deckTitle, setDeckTitle] = useState('')
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [studyDeckId, setStudyDeckId] = useState<string | null>(null)
  const [studyQueue, setStudyQueue] = useState<Flashcard[]>([])
  const [flipped, setFlipped] = useState(false)
  const [studyIndex, setStudyIndex] = useState(0)

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    const [dRes, cRes] = await Promise.all([
      supabase.from('flashcard_decks').select('*').eq('user_id', user.id).order('title'),
      supabase.from('flashcards').select('*').eq('user_id', user.id),
    ])
    setDecks((dRes.data as FlashcardDeck[]) ?? [])
    setCards((cRes.data as Flashcard[]) ?? [])
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    void load()
  }, [load])

  const dueCount = useMemo(
    () => cards.filter((c) => new Date(c.next_review_at) <= new Date()).length,
    [cards],
  )

  const createDeck = async () => {
    if (!supabase || !user || !deckTitle.trim()) return
    const { error } = await supabase.from('flashcard_decks').insert({
      user_id: user.id,
      title: deckTitle.trim(),
    })
    if (error) toast({ title: 'Failed', description: error.message, kind: 'error' })
    setDeckOpen(false)
    setDeckTitle('')
    await load()
  }

  const addCard = async () => {
    if (!supabase || !user || !selectedDeck || !front.trim() || !back.trim()) return
    const { error } = await supabase.from('flashcards').insert({
      deck_id: selectedDeck,
      user_id: user.id,
      front: front.trim(),
      back: back.trim(),
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
      next_review_at: new Date().toISOString(),
    })
    if (error) toast({ title: 'Failed', description: error.message, kind: 'error' })
    setCardOpen(false)
    setFront('')
    setBack('')
    await load()
  }

  const deleteDeck = async (id: string) => {
    if (!supabase || !confirm('Delete deck and cards?')) return
    await supabase.from('flashcards').delete().eq('deck_id', id)
    await supabase.from('flashcard_decks').delete().eq('id', id)
    await load()
  }

  const startStudy = (deckId: string) => {
    const deckCards = cards.filter(
      (c) => c.deck_id === deckId && new Date(c.next_review_at) <= new Date(),
    )
    const queue = deckCards.length > 0 ? deckCards : cards.filter((c) => c.deck_id === deckId)
    const shuffled = [...queue].sort(() => Math.random() - 0.5)
    setStudyDeckId(deckId)
    setStudyQueue(shuffled)
    setStudyIndex(0)
    setFlipped(false)
  }

  const rate = async (quality: number) => {
    const card = studyQueue[studyIndex]
    if (!supabase || !user || !card) return
    const next = reviewCard(
      {
        ease_factor: card.ease_factor,
        interval_days: card.interval_days,
        repetitions: card.repetitions,
      },
      quality,
    )
    await supabase
      .from('flashcards')
      .update({
        ease_factor: next.ease_factor,
        interval_days: next.interval_days,
        repetitions: next.repetitions,
        next_review_at: next.next_review_at,
      })
      .eq('id', card.id)
    await supabase.from('flashcard_reviews').insert({
      flashcard_id: card.id,
      user_id: user.id,
      quality,
    })
    setFlipped(false)
    if (studyIndex >= studyQueue.length - 1) {
      setStudyDeckId(null)
      setStudyQueue([])
      await load()
      toast({ title: 'Study session complete', kind: 'success' })
    } else {
      setStudyIndex((i) => i + 1)
    }
  }

  const studyCard = studyQueue[studyIndex]

  if (!supabase) return <SupabaseSetupBanner />

  if (studyDeckId && studyCard) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Badge variant="accent">{studyIndex + 1} / {studyQueue.length}</Badge>
        <Card
          className="min-h-48 cursor-pointer rounded-2xl"
          onClick={() => setFlipped((f) => !f)}
        >
          <CardContent className="flex min-h-48 items-center justify-center p-8 text-center">
            {flipped ? studyCard.back : studyCard.front}
          </CardContent>
        </Card>
        {flipped ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => void rate(1)}>
              Needs revision
            </Button>
            <Button variant="outline" onClick={() => void rate(3)}>
              Okay
            </Button>
            <Button className="col-span-2" onClick={() => void rate(5)}>
              Known well
            </Button>
          </div>
        ) : (
          <p className="text-center text-sm text-ink-muted">Tap card to flip</p>
        )}
        <Button variant="ghost" onClick={() => setStudyDeckId(null)}>
          Exit study
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="warning">{dueCount} due for review</Badge>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDeckOpen(true)}>
            <Plus className="h-4 w-4" />
            Deck
          </Button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : decks.length === 0 ? (
        <EmptyState icon={Layers} title="No decks" action={<Button onClick={() => setDeckOpen(true)}>Create deck</Button>} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {decks.map((d) => {
            const count = cards.filter((c) => c.deck_id === d.id).length
            const due = cards.filter(
              (c) => c.deck_id === d.id && new Date(c.next_review_at) <= new Date(),
            ).length
            return (
              <Card key={d.id} className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base">{d.title}</CardTitle>
                  <p className="text-sm text-ink-muted">
                    {count} cards · {due} due
                  </p>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => startStudy(d.id)}>
                    <Shuffle className="h-4 w-4" />
                    Study
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedDeck(d.id)
                      setCardOpen(true)
                    }}
                  >
                    Add card
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void deleteDeck(d.id)}>
                    Delete
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={deckOpen} onOpenChange={setDeckOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>New deck</DialogTitle></DialogHeader>
          <Label>Title</Label>
          <Input value={deckTitle} onChange={(e) => setDeckTitle(e.target.value)} />
          <Button className="mt-3 w-full" onClick={() => void createDeck()}>
            Create
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>New card</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Front</Label>
              <Input value={front} onChange={(e) => setFront(e.target.value)} />
            </div>
            <div>
              <Label>Back</Label>
              <Input value={back} onChange={(e) => setBack(e.target.value)} />
            </div>
            <Button className="w-full" onClick={() => void addCard()}>
              Save card
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
