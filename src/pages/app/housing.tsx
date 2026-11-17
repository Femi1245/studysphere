import { format, parseISO } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Building2, Heart, MapPin, Search, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/contexts/auth-context'
import { trySupabase } from '@/lib/supabase/client'
import type { HousingInspectionRequest, HousingListing } from '@/types/database'

const housingTypes = [
  { value: 'room', label: 'Room' },
  { value: 'self_contained', label: 'Self-contained' },
  { value: 'shared_apartment', label: 'Shared apartment' },
  { value: 'hostel_bed_space', label: 'Hostel bed space' },
] as const

const naira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

const typeLabel = (value: HousingListing['property_type']) =>
  housingTypes.find((type) => type.value === value)?.label ?? value

const verificationLabel: Record<HousingListing['verification_status'], string> = {
  unverified: 'Not yet verified',
  identity_checked: 'Identity checked',
  provider_checked: 'Provider checked',
  property_inspected: 'Property inspected',
}

function totalMoveInCost(listing: HousingListing) {
  return (
    Number(listing.rent_amount) +
    Number(listing.agent_fee) +
    Number(listing.agreement_fee) +
    Number(listing.caution_fee) +
    Number(listing.service_charge)
  )
}

function ListingCard({
  listing,
  favorite,
  onFavorite,
  onInspect,
}: {
  listing: HousingListing
  favorite: boolean
  onFavorite: () => void
  onInspect: () => void
}) {
  return (
    <Card className="h-full rounded-2xl">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg">{listing.title}</CardTitle>
            <CardDescription className="mt-1 flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {listing.area} · {listing.institution_name}
            </CardDescription>
            <p className="mt-1 text-xs text-ink-muted">
              Availability confirmed {format(parseISO(listing.availability_checked_at), 'MMM d, yyyy')}
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-border p-2 text-ink-muted hover:text-danger"
            aria-label={favorite ? 'Remove from saved housing' : 'Save housing'}
            onClick={onFavorite}
          >
            <Heart className={`h-4 w-4 ${favorite ? 'fill-current text-danger' : ''}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge>{typeLabel(listing.property_type)}</Badge>
          <Badge variant={listing.verification_status === 'unverified' ? 'outline' : 'success'}>
            {listing.verification_status === 'unverified' ? (
              <ShieldCheck className="mr-1 h-3 w-3" />
            ) : (
              <BadgeCheck className="mr-1 h-3 w-3" />
            )}
            {verificationLabel[listing.verification_status]}
          </Badge>
        </div>
        <p className="line-clamp-3 text-sm text-ink-muted">{listing.description}</p>
        <div className="rounded-xl bg-surface p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-semibold">{naira.format(Number(listing.rent_amount))}</span>
            <span className="text-xs text-ink-muted">per {listing.rent_period}</span>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Estimated first payment: {naira.format(totalMoveInCost(listing))}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Rent and listed fees only; confirm other terms with the provider.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="flex-1" size="sm" onClick={onInspect}>
            Request inspection
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function HousingPage() {
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const supabase = trySupabase()
  const [listings, setListings] = useState<HousingListing[]>([])
  const [favorites, setFavorites] = useState<string[]>([])
  const [myListings, setMyListings] = useState<HousingListing[]>([])
  const [studentInspectionRequests, setStudentInspectionRequests] = useState<HousingInspectionRequest[]>([])
  const [inspectionRequests, setInspectionRequests] = useState<HousingInspectionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [view, setView] = useState<'discover' | 'provider'>('discover')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [maxRent, setMaxRent] = useState('')
  const [selected, setSelected] = useState<HousingListing | null>(null)
  const [preferredAt, setPreferredAt] = useState('')
  const [inspectionMin] = useState(() => new Date(Date.now() + 60_000).toISOString().slice(0, 16))
  const [requestMessage, setRequestMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const [editingListingId, setEditingListingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [institution, setInstitution] = useState(profile?.school ?? '')
  const [area, setArea] = useState('')
  const [propertyType, setPropertyType] = useState<HousingListing['property_type']>('room')
  const [rent, setRent] = useState('')
  const [rentPeriod, setRentPeriod] = useState<HousingListing['rent_period']>('year')
  const [agentFee, setAgentFee] = useState('0')
  const [agreementFee, setAgreementFee] = useState('0')
  const [cautionFee, setCautionFee] = useState('0')
  const [serviceCharge, setServiceCharge] = useState('0')
  const [amenities, setAmenities] = useState('')

  const load = useCallback(async () => {
    if (!supabase || !user) return
    setLoading(true)
    setLoadError(null)
    const [publicRes, mineRes, favoriteRes, studentRequestsRes] = await Promise.all([
      supabase
        .from('housing_listings')
        .select('*')
        .eq('status', 'published')
        .gte('availability_checked_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('housing_listings').select('*').eq('provider_id', user.id).order('updated_at', { ascending: false }),
      supabase.from('housing_favorites').select('listing_id').eq('user_id', user.id),
      supabase
        .from('housing_inspection_requests')
        .select('*, housing_listings(title, area)')
        .eq('student_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    const failed = [publicRes.error, mineRes.error, favoriteRes.error, studentRequestsRes.error].find(Boolean)
    if (failed) {
      setLoadError(
        `Housing data could not be loaded: ${failed.message}. Apply the latest Supabase migration, then reload this page.`,
      )
      setLoading(false)
      return
    }

    const mine = (mineRes.data as HousingListing[]) ?? []
    setMyListings(mine)
    setListings((publicRes.data as HousingListing[]) ?? [])
    setFavorites(((favoriteRes.data as { listing_id: string }[]) ?? []).map((row) => row.listing_id))
    setStudentInspectionRequests((studentRequestsRes.data as HousingInspectionRequest[]) ?? [])

    if (mine.length) {
      const requestRes = await supabase
        .from('housing_inspection_requests')
        .select('*, housing_listings(title, area)')
        .in('listing_id', mine.map((listing) => listing.id))
        .order('created_at', { ascending: false })
        .limit(50)
      if (requestRes.error) {
        setLoadError(`Could not load inspection requests: ${requestRes.error.message}`)
      } else {
        setInspectionRequests((requestRes.data as HousingInspectionRequest[]) ?? [])
      }
    } else {
      setInspectionRequests([])
    }
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    void load()
  }, [load])

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase()
    const budget = maxRent ? Number(maxRent) : null
    return listings.filter((listing) => {
      const matchesText =
        !query ||
        [listing.title, listing.area, listing.institution_name, listing.description]
          .some((value) => value.toLowerCase().includes(query))
      const matchesType = !typeFilter || listing.property_type === typeFilter
      const matchesBudget = budget === null || Number(listing.rent_amount) <= budget
      return matchesText && matchesType && matchesBudget
    })
  }, [listings, maxRent, search, typeFilter])

  const toggleFavorite = async (listingId: string) => {
    if (!supabase || !user) return
    const alreadySaved = favorites.includes(listingId)
    const result = alreadySaved
      ? await supabase.from('housing_favorites').delete().eq('user_id', user.id).eq('listing_id', listingId)
      : await supabase.from('housing_favorites').insert({ user_id: user.id, listing_id: listingId })
    if (result.error) {
      toast({ title: 'Could not update saved housing', description: result.error.message, kind: 'error' })
      return
    }
    setFavorites((current) =>
      alreadySaved ? current.filter((id) => id !== listingId) : [...current, listingId],
    )
  }

  const submitInspectionRequest = async () => {
    if (!supabase || !user || !selected || !preferredAt || busy) return
    const date = new Date(preferredAt)
    if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
      toast({ title: 'Choose a future inspection time', kind: 'error' })
      return
    }
    setBusy(true)
    const { error } = await supabase.from('housing_inspection_requests').insert({
      listing_id: selected.id,
      student_id: user.id,
      preferred_at: date.toISOString(),
      message: requestMessage.trim(),
    })
    setBusy(false)
    if (error) {
      toast({ title: 'Inspection request failed', description: error.message, kind: 'error' })
      return
    }
    toast({ title: 'Inspection requested', description: 'The provider can now respond to your request.', kind: 'success' })
    setSelected(null)
    setPreferredAt('')
    setRequestMessage('')
  }

  const submitListing = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !user || busy) return
    setBusy(true)
    const listingFields = {
      title: title.trim(),
      description: description.trim(),
      institution_name: institution.trim(),
      area: area.trim(),
      property_type: propertyType,
      rent_amount: Number(rent),
      rent_period: rentPeriod,
      agent_fee: Number(agentFee) || 0,
      agreement_fee: Number(agreementFee) || 0,
      caution_fee: Number(cautionFee) || 0,
      service_charge: Number(serviceCharge) || 0,
      amenities: amenities.split(',').map((item) => item.trim()).filter(Boolean),
      status: 'submitted',
    }
    const result = editingListingId
      ? await supabase
          .from('housing_listings')
          .update(listingFields)
          .eq('id', editingListingId)
          .eq('provider_id', user.id)
      : await supabase.from('housing_listings').insert({ ...listingFields, provider_id: user.id })
    setBusy(false)
    if (result.error) {
      toast({ title: 'Listing submission failed', description: result.error.message, kind: 'error' })
      return
    }
    toast({
      title: editingListingId ? 'Listing updated for review' : 'Listing submitted for review',
      description: 'It will appear in student search after an admin reviews it.',
      kind: 'success',
    })
    setEditingListingId(null)
    setTitle('')
    setDescription('')
    setArea('')
    setRent('')
    setAmenities('')
    await load()
  }

  const editListing = (listing: HousingListing) => {
    setEditingListingId(listing.id)
    setTitle(listing.title)
    setDescription(listing.description)
    setInstitution(listing.institution_name)
    setArea(listing.area)
    setPropertyType(listing.property_type)
    setRent(String(listing.rent_amount))
    setRentPeriod(listing.rent_period)
    setAgentFee(String(listing.agent_fee))
    setAgreementFee(String(listing.agreement_fee))
    setCautionFee(String(listing.caution_fee))
    setServiceCharge(String(listing.service_charge))
    setAmenities(listing.amenities.join(', '))
  }

  const cancelListingEdit = () => {
    setEditingListingId(null)
    setTitle('')
    setDescription('')
    setInstitution(profile?.school ?? '')
    setArea('')
    setPropertyType('room')
    setRent('')
    setRentPeriod('year')
    setAgentFee('0')
    setAgreementFee('0')
    setCautionFee('0')
    setServiceCharge('0')
    setAmenities('')
  }

  const updateInspectionStatus = async (
    request: HousingInspectionRequest,
    status: HousingInspectionRequest['status'],
  ) => {
    if (!supabase) return
    const { error } = await supabase
      .from('housing_inspection_requests')
      .update({ status })
      .eq('id', request.id)
    if (error) {
      toast({ title: 'Could not update request', description: error.message, kind: 'error' })
      return
    }
    await load()
  }

  const updateProviderListing = async (listing: HousingListing, status: HousingListing['status']) => {
    if (!supabase || status === 'published' || status === 'rejected') return
    const { error } = await supabase
      .from('housing_listings')
      .update({ status })
      .eq('id', listing.id)
      .eq('provider_id', user?.id ?? '')
    if (error) {
      toast({ title: 'Could not update listing', description: error.message, kind: 'error' })
      return
    }
    await load()
  }

  const reconfirmAvailability = async (listing: HousingListing) => {
    if (!supabase || !user) return
    const { error } = await supabase
      .from('housing_listings')
      .update({ availability_checked_at: new Date().toISOString() })
      .eq('id', listing.id)
      .eq('provider_id', user.id)
    if (error) {
      toast({ title: 'Could not reconfirm availability', description: error.message, kind: 'error' })
      return
    }
    toast({ title: 'Availability reconfirmed', kind: 'success' })
    await load()
  }

  const feeFields: { label: string; value: string; onChange: (value: string) => void }[] = [
    { label: 'Agent fee', value: agentFee, onChange: setAgentFee },
    { label: 'Agreement fee', value: agreementFee, onChange: setAgreementFee },
    { label: 'Caution fee', value: cautionFee, onChange: setCautionFee },
    { label: 'Service charge', value: serviceCharge, onChange: setServiceCharge },
  ]

  if (!supabase) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-ink-muted">Connect Supabase to use the housing marketplace.</CardContent>
      </Card>
    )
  }

  if (loading) return <Skeleton className="h-96 rounded-2xl" />

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-primary-100 bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-900/30 dark:to-accent-900/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-display text-2xl">
            <Building2 className="h-6 w-6" /> Housing near campus
          </CardTitle>
          <CardDescription>
            Compare listed rent and extra fees, save rooms, and request an inspection. Confirm availability and terms directly before paying.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant={view === 'discover' ? 'default' : 'outline'} onClick={() => setView('discover')}>
            Find housing
          </Button>
          <Button variant={view === 'provider' ? 'default' : 'outline'} onClick={() => setView('provider')}>
            Provider console
          </Button>
        </CardContent>
      </Card>

      {loadError ? (
        <div role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {loadError}
        </div>
      ) : null}

      {view === 'discover' ? (
        <>
          <Card className="rounded-2xl">
            <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_200px_180px]">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-ink-muted" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search school, area, or listing"
                  aria-label="Search housing listings"
                />
              </div>
              <select
                className="h-11 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-ink"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label="Filter by property type"
              >
                <option value="">All housing types</option>
                {housingTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              <Input
                type="number"
                min="0"
                value={maxRent}
                onChange={(event) => setMaxRent(event.target.value)}
                placeholder="Maximum rent (₦)"
                aria-label="Maximum rent"
              />
            </CardContent>
          </Card>

          {studentInspectionRequests.length > 0 ? (
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-lg">Your inspection requests</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {studentInspectionRequests.map((request) => (
                  <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium">{request.housing_listings?.title ?? 'Housing request'}</p>
                      <p className="text-ink-muted">
                        {request.housing_listings?.area ?? 'Area not available'} · {new Date(request.preferred_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={request.status === 'pending' ? 'warning' : 'outline'}>{request.status}</Badge>
                      {request.status === 'pending' ? (
                        <Button size="sm" variant="outline" onClick={() => void updateInspectionStatus(request, 'cancelled')}>
                          Cancel
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {selected ? (
            <Card className="rounded-2xl border-primary-200">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div>
                  <CardTitle>{selected.title}</CardTitle>
                  <CardDescription>{selected.area} · {selected.institution_name}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Close</Button>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-ink-muted">{selected.description}</p>
                  {selected.amenities.length ? (
                    <div className="flex flex-wrap gap-2">
                      {selected.amenities.map((amenity) => <Badge key={amenity} variant="outline">{amenity}</Badge>)}
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-border p-3 text-sm">
                    <p className="font-medium">Estimated move-in costs</p>
                    <dl className="mt-2 space-y-1 text-ink-muted">
                      <div className="flex justify-between"><dt>Rent</dt><dd>{naira.format(Number(selected.rent_amount))}</dd></div>
                      <div className="flex justify-between"><dt>Agent fee</dt><dd>{naira.format(Number(selected.agent_fee))}</dd></div>
                      <div className="flex justify-between"><dt>Agreement fee</dt><dd>{naira.format(Number(selected.agreement_fee))}</dd></div>
                      <div className="flex justify-between"><dt>Caution fee</dt><dd>{naira.format(Number(selected.caution_fee))}</dd></div>
                      <div className="flex justify-between"><dt>Service charge</dt><dd>{naira.format(Number(selected.service_charge))}</dd></div>
                      <div className="flex justify-between border-t border-border pt-2 font-semibold text-ink"><dt>Listed total</dt><dd>{naira.format(totalMoveInCost(selected))}</dd></div>
                    </dl>
                  </div>
                </div>
                <div className="space-y-3 rounded-2xl bg-surface p-4">
                  <h3 className="font-semibold">Request an inspection</h3>
                  <p className="text-xs text-ink-muted">Do not send money before you have independently checked the property and provider.</p>
                  <Label htmlFor="inspection-time">Preferred date and time</Label>
                  <Input
                    id="inspection-time"
                    type="datetime-local"
                    value={preferredAt}
                    onChange={(event) => setPreferredAt(event.target.value)}
                    min={inspectionMin}
                  />
                  <Label htmlFor="inspection-message">Message (optional)</Label>
                  <Textarea
                    id="inspection-message"
                    maxLength={1000}
                    value={requestMessage}
                    onChange={(event) => setRequestMessage(event.target.value)}
                    placeholder="Ask a question or suggest another time"
                  />
                  <Button className="w-full" disabled={busy || !preferredAt} onClick={() => void submitInspectionRequest()}>
                    {busy ? 'Sending…' : 'Send inspection request'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {filteredListings.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="py-10 text-center">
                <Building2 className="mx-auto h-8 w-8 text-ink-muted" />
                <p className="mt-3 font-medium">No published listings match these filters</p>
                <p className="mt-1 text-sm text-ink-muted">Try another area or budget, or check back when providers add rooms.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  favorite={favorites.includes(listing.id)}
                  onFavorite={() => void toggleFavorite(listing.id)}
                  onInspect={() => {
                    setSelected(listing)
                    setPreferredAt('')
                    setRequestMessage('')
                  }}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>{editingListingId ? 'Edit housing listing' : 'Submit a housing listing'}</CardTitle>
              <CardDescription>
                  New listings are reviewed by an admin before students can find them. Published listings are hidden after 14 days without availability confirmation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={(event) => void submitListing(event)}>
                <div className="space-y-1.5">
                  <Label htmlFor="housing-title">Listing title</Label>
                  <Input id="housing-title" required minLength={5} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="housing-description">Description</Label>
                  <Textarea id="housing-description" required minLength={20} maxLength={5000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="housing-institution">Institution</Label>
                    <Input id="housing-institution" required maxLength={160} value={institution} onChange={(event) => setInstitution(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="housing-area">Area / neighborhood</Label>
                    <Input id="housing-area" required maxLength={160} value={area} onChange={(event) => setArea(event.target.value)} />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="housing-type">Housing type</Label>
                    <select id="housing-type" className="h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm" value={propertyType} onChange={(event) => setPropertyType(event.target.value as HousingListing['property_type'])}>
                      {housingTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="housing-rent">Rent (₦)</Label>
                    <Input id="housing-rent" required type="number" min="0" step="100" value={rent} onChange={(event) => setRent(event.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="housing-period">Rent period</Label>
                  <select id="housing-period" className="h-11 w-full rounded-xl border border-border bg-surface-elevated px-3 text-sm" value={rentPeriod} onChange={(event) => setRentPeriod(event.target.value as HousingListing['rent_period'])}>
                    <option value="year">Per year</option>
                    <option value="semester">Per semester</option>
                    <option value="month">Per month</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {feeFields.map(({ label, value, onChange }) => (
                    <div key={label} className="space-y-1.5">
                      <Label htmlFor={`housing-${label.toLowerCase().replaceAll(' ', '-')}`}>{label} (₦)</Label>
                      <Input
                        id={`housing-${label.toLowerCase().replaceAll(' ', '-')}`}
                        type="number"
                        min="0"
                        step="100"
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="housing-amenities">Amenities (comma separated)</Label>
                  <Input id="housing-amenities" value={amenities} onChange={(event) => setAmenities(event.target.value)} placeholder="Water, security, furnished" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" className="flex-1" disabled={busy}>
                    {busy ? 'Saving…' : editingListingId ? 'Save changes for review' : 'Submit for admin review'}
                  </Button>
                  {editingListingId ? (
                    <Button type="button" variant="outline" disabled={busy} onClick={cancelListingEdit}>Cancel</Button>
                  ) : null}
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-2xl">
              <CardHeader><CardTitle>Your listings</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {myListings.length === 0 ? (
                  <p className="text-sm text-ink-muted">Your submitted and published listings will appear here.</p>
                ) : myListings.map((listing) => (
                  <div key={listing.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{listing.title}</p>
                        <p className="text-sm text-ink-muted">{listing.area} · {naira.format(Number(listing.rent_amount))} / {listing.rent_period}</p>
                      </div>
                      <Badge variant={listing.status === 'published' ? 'success' : 'outline'}>{listing.status}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-ink-muted">{verificationLabel[listing.verification_status]}</p>
                    <p className="text-xs text-ink-muted">
                      Availability confirmed {format(parseISO(listing.availability_checked_at), 'MMM d, yyyy')}
                    </p>
                    {listing.review_notes ? <p className="mt-1 text-sm text-ink-muted">Admin note: {listing.review_notes}</p> : null}
                    {listing.status === 'published' ? (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => editListing(listing)}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => void reconfirmAvailability(listing)}>Reconfirm availability</Button>
                        <Button size="sm" variant="outline" onClick={() => void updateProviderListing(listing, 'paused')}>Pause listing</Button>
                        <Button size="sm" variant="outline" onClick={() => void updateProviderListing(listing, 'occupied')}>Mark occupied</Button>
                      </div>
                    ) : null}
                    {listing.status !== 'published' ? (
                      <Button className="mt-3" size="sm" variant="outline" onClick={() => editListing(listing)}>Edit and submit for review</Button>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader><CardTitle>Inspection requests</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {inspectionRequests.length === 0 ? (
                  <p className="text-sm text-ink-muted">Requests for your listings will appear here.</p>
                ) : inspectionRequests.map((request) => (
                  <div key={request.id} className="rounded-xl border border-border p-3 text-sm">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-medium">{request.housing_listings?.title ?? 'Housing inspection'}</p>
                      <Badge variant={request.status === 'pending' ? 'warning' : 'outline'}>{request.status}</Badge>
                    </div>
                    <p className="mt-1 text-ink-muted">{new Date(request.preferred_at).toLocaleString()}</p>
                    {request.message ? <p className="mt-2 whitespace-pre-wrap text-ink-muted">{request.message}</p> : null}
                    {request.status === 'pending' ? (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => void updateInspectionStatus(request, 'accepted')}>Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => void updateInspectionStatus(request, 'declined')}>Decline</Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
