import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { getExercise, parseYoutubeId, youtubeSearchUrl } from '../data/exercises'
import { Btn, Chip, Icon, inputCls, Sheet } from './ui'
import { useApp } from '../hooks/app'

function VideoBlock({ exerciseId }: { exerciseId: string }) {
  const { toast } = useApp()
  const ex = getExercise(exerciseId)
  const override = useLiveQuery(() => db.videos.get(exerciseId), [exerciseId])
  const [playing, setPlaying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [link, setLink] = useState('')
  const online = typeof navigator === 'undefined' ? true : navigator.onLine

  const save = async () => {
    const id = parseYoutubeId(link)
    if (!id) return toast("That doesn't look like a YouTube link")
    await db.videos.put({ exerciseId, videoId: id })
    setEditing(false)
    setLink('')
    toast('Video saved for this exercise')
  }

  return (
    <section aria-label="Video demo" className="space-y-2">
      {override ? (
        playing ? (
          online ? (
            <div className="aspect-video overflow-hidden rounded-2xl bg-black">
              <iframe
                title={`${ex.name} demo`}
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${override.videoId}?rel=0&modestbranding=1&playsinline=1&autoplay=1`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : (
            <p className="rounded-2xl bg-surface2 p-4 text-sm text-muted">You're offline - the video will play when you're back online. The steps below work offline.</p>
          )
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl bg-surface2 text-ink"
          >
            <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-fg">
              <Icon name="play" size={26} fill />
            </span>
            <span className="text-sm font-semibold">Play demo video</span>
          </button>
        )
      ) : (
        <a
          href={youtubeSearchUrl(ex)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-surface2 px-4 font-semibold"
        >
          <Icon name="video" /> Watch a demo on YouTube <Icon name="external" size={16} />
        </a>
      )}

      {editing ? (
        <div className="space-y-2 rounded-2xl bg-surface2 p-3">
          <input
            aria-label="YouTube link"
            className={inputCls}
            placeholder="Paste a YouTube link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Btn size="sm" onClick={save}>
              Save
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Btn>
            {override && (
              <Btn
                size="sm"
                variant="danger"
                onClick={async () => {
                  await db.videos.delete(exerciseId)
                  setEditing(false)
                  setPlaying(false)
                }}
              >
                Remove
              </Btn>
            )}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="text-sm text-muted underline underline-offset-2">
          {override ? 'Change video' : 'Found a video you like? Pin it here so it plays in the app'}
        </button>
      )}
    </section>
  )
}

export function ExerciseGuide({ exerciseId, onOpenOther }: { exerciseId: string; onOpenOther?: (id: string) => void }) {
  const ex = getExercise(exerciseId)
  return (
    <div className="space-y-5 pb-2">
      <div className="flex flex-wrap gap-1.5">
        {ex.muscles.map((m) => (
          <Chip key={m} tone="accent">
            {m}
          </Chip>
        ))}
        {ex.perSide && <Chip>Each side</Chip>}
      </div>

      <VideoBlock exerciseId={exerciseId} />

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">How to do it</h3>
        <ol className="space-y-2.5">
          {ex.steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-fg">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {ex.tips.length > 0 && (
        <section className="rounded-2xl bg-accent-soft p-4">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-accent">
            <Icon name="bolt" size={16} /> Tips &amp; tricks
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {ex.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {ex.mistakes.length > 0 && (
        <section className="rounded-2xl bg-warn-soft p-4">
          <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-warn">
            <Icon name="info" size={16} /> Common mistakes
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {ex.mistakes.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      )}

      {(ex.easierId || ex.harderId) && onOpenOther && (
        <section className="grid grid-cols-2 gap-2">
          {ex.easierId && (
            <Btn variant="soft" size="sm" onClick={() => onOpenOther(ex.easierId!)}>
              Easier: {getExercise(ex.easierId).name}
            </Btn>
          )}
          {ex.harderId && (
            <Btn variant="soft" size="sm" onClick={() => onOpenOther(ex.harderId!)}>
              Harder: {getExercise(ex.harderId).name}
            </Btn>
          )}
        </section>
      )}
    </div>
  )
}

/** Sheet wrapper that lets the user hop to the easier / harder variant's guide. */
export function ExerciseSheet({ exerciseId, onClose }: { exerciseId: string | null; onClose: () => void }) {
  const [override, setOverride] = useState<{ base: string | null; id: string | null }>({ base: null, id: null })
  // reset the hop whenever a different base exercise is opened
  const id = override.base === exerciseId && override.id ? override.id : exerciseId
  return (
    <Sheet open={!!exerciseId} onClose={onClose} title={id ? getExercise(id).name : ''}>
      {id && <ExerciseGuide key={id} exerciseId={id} onOpenOther={(x) => setOverride({ base: exerciseId, id: x })} />}
    </Sheet>
  )
}
