// The studio (games/design/README.md 6.7): workspaces over the operation set, one for each role. Build (PackageStudio.jsx)
// opens a package: its levels, parts, entries, tags, relations, trays, sections and overrides. Arrange
// (GameStudio.jsx) opens a game: the packages it uses, its chapters and their maps, its overrides of relations. The bar switches between them; each keeps
// its own pending changes, and only its own side's operations run in it. Copy (CopyStudio.jsx) opens a package or a
// game: every text of it, in every language.
import './studio.css'
import { useEffect, useState } from 'react'
import { T, tr } from '../shell/i18n.js'
import { useLang } from '../shell/useLang.js'
import { call, loadCatalogs, refreshContent } from './api.js'
import { useContentRevision } from './useChangeset.js'
import PackageStudio from './PackageStudio.jsx'
import GameStudio from './GameStudio.jsx'
import CopyStudio from './CopyStudio.jsx'
import Loading from './Loading.jsx'
import StudioBar from './StudioBar.jsx'

const QUERY = new URLSearchParams(window.location.search)
// The address's workspace, by its name or the names it had.
const SPACE_OF = { build: 'build', package: 'build', arrange: 'arrange', game: 'arrange', copy: 'copy' }

export default function Studio({ initialCatalogs }) {
  useLang()
  const revision = useContentRevision()
  const [games, setGames] = useState(null)
  const [space, setSpace] = useState(SPACE_OF[QUERY.get('space')] ?? 'build')
  const [game, setGame] = useState(QUERY.get('game'))
  const [packages, setPackages] = useState(null)
  const [pkg, setPkg] = useState(QUERY.get('package'))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  // What the copy workspace opens: a package or a game.
  const [copyOpen, setCopyOpen] = useState(() => (space === 'copy' && QUERY.get('game') ? 'game' : space === 'copy' && QUERY.get('package') === 'kernel' ? 'kernel' : 'package'))
  const showGames = (list) => {
    setGames(list)
    setGame((id) => (list.some((g) => g.id === id) ? id : list[0]?.id ?? null))
    return list
  }
  const showPackages = (list) => {
    setPackages(list)
    setPkg((id) => (list.some((p) => p.id === id) ? id : list[0]?.id ?? null))
    return list
  }
  useEffect(() => {
    let live = true
    setLoading(true)
    setLoadError(null)
    const request = revision === 0 && initialCatalogs ? initialCatalogs : loadCatalogs()
    request.then(([games, packages]) => {
      if (!live) return
      showGames(games)
      showPackages(packages)
    }).catch(error => { if (live) setLoadError(error) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [revision, initialCatalogs])
  // A package just made: listed, and opened unless the author keeps the one open (`stay`).
  const madePackage = (id, stay = false) => call('packages', {}).then(showPackages).then(() => { if (!stay) setPkg(id) })
  if ((!games || !packages) && loadError) return <main className="studio-loading">
    <div role="alert">
      <strong>{tr('无法读取工作区')}</strong>
      <p className="studio-load-error">{loadError.message}</p>
    </div>
    <button className="kit-btn" type="button" onClick={refreshContent}>{tr('再试一次')}</button>
  </main>
  if (!games || !packages) return <Loading />
  const switcher = { value: space, onChange: setSpace }
  const catalog = { loading, error: loadError }
  if (!packages.length || (space === 'arrange' && !games.length)) return <div className="studio">
    <StudioBar space={switcher} ops={[]} catalog={catalog} />
    <div className="studio-loading">{tr("没有内容")}</div>
  </div>
  if (space === 'copy') {
    const opened = copyOpen === 'game' ? { game } : { package: copyOpen === 'kernel' ? 'kernel' : pkg }
    return <CopyStudio key={copyOpen === 'game' ? `game:${game}` : `package:${opened.package}`} opened={opened} packages={[...packages, { id: 'kernel', kind: 'lib', title: T('内核'), source: 'workspace' }]} games={games} space={switcher} catalog={catalog}
      onOpen={(next) => { if (next.game) { setGame(next.game); setCopyOpen('game') } else if (next.package === 'kernel') setCopyOpen('kernel'); else { setPkg(next.package); setCopyOpen('package') } }} />
  }
  return space === 'arrange'
    ? <GameStudio game={game} games={games} onGame={setGame} onMade={(id) => call('games', {}).then(showGames).then(() => { if (id) setGame(id) })} packages={packages} onBuild={(id) => { setPkg(id); setSpace('build') }} space={switcher} catalog={catalog} />
    : <PackageStudio key={pkg} pkg={pkg} packages={packages} games={games} onPackage={setPkg} onMadePackage={madePackage} space={switcher} catalog={catalog} />
}
