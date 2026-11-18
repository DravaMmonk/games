// The studio (games/design/README.md 6.7): workspaces over the operation set, one for each role. Build (PackageStudio.jsx)
// opens a package: its levels, parts, entries, tags, relations, trays, sections and overrides. Arrange
// (GameStudio.jsx) opens a game: the packages it uses, its chapters and their maps, its overrides of relations. The bar switches between them; each keeps
// its own pending changes, and only its own side's operations run in it. Copy (CopyStudio.jsx) opens a package or a
// game: every text of it, in every language.
import './studio.css'
import { useEffect, useState } from 'react'
import { T, tr } from '../shell/i18n.js'
import { useLang } from '../shell/useLang.js'
import { call } from './api.js'
import PackageStudio from './PackageStudio.jsx'
import GameStudio from './GameStudio.jsx'
import CopyStudio from './CopyStudio.jsx'

const QUERY = new URLSearchParams(window.location.search)
// The address's workspace, by its name or the names it had.
const SPACE_OF = { build: 'build', package: 'build', arrange: 'arrange', game: 'arrange', copy: 'copy' }

export default function Studio() {
  useLang()
  const [games, setGames] = useState(null)
  const [space, setSpace] = useState(SPACE_OF[QUERY.get('space')] ?? 'build')
  const [game, setGame] = useState(QUERY.get('game'))
  const [packages, setPackages] = useState(null)
  const [pkg, setPkg] = useState(QUERY.get('package'))
  // What the copy workspace opens: a package or a game.
  const [copyOpen, setCopyOpen] = useState(() => (space === 'copy' && QUERY.get('game') ? 'game' : space === 'copy' && QUERY.get('package') === 'kernel' ? 'kernel' : 'package'))
  const reload = () => call('games', {}).then((list) => {
    setGames(list)
    setGame((id) => (list.some((g) => g.id === id) ? id : list[0]?.id ?? null))
    return list
  })
  const reloadPackages = () => call('packages', {}).then((list) => {
    setPackages(list)
    setPkg((id) => (list.some((p) => p.id === id) ? id : list[0]?.id ?? null))
    return list
  })
  useEffect(() => {
    reload()
    reloadPackages()
  }, [])
  // A package just made: listed, and opened unless the author keeps the one open (`stay`).
  const madePackage = (id, stay = false) => reloadPackages().then(() => { if (!stay) setPkg(id) })
  if (!games || !packages) return <div className="studio-loading">{tr('读取中……')}</div>
  if (!packages.length || (space === 'arrange' && !games.length)) return <div className="studio-loading">{tr("没有内容")}</div>
  const switcher = { value: space, onChange: setSpace }
  if (space === 'copy') {
    const opened = copyOpen === 'game' ? { game } : { package: copyOpen === 'kernel' ? 'kernel' : pkg }
    return <CopyStudio key={copyOpen === 'game' ? `game:${game}` : `package:${opened.package}`} opened={opened} packages={[...packages, { id: 'kernel', kind: 'lib', title: T('内核'), source: 'workspace' }]} games={games} space={switcher}
      onOpen={(next) => { if (next.game) { setGame(next.game); setCopyOpen('game') } else if (next.package === 'kernel') setCopyOpen('kernel'); else { setPkg(next.package); setCopyOpen('package') } }} />
  }
  return space === 'arrange'
    ? <GameStudio game={game} games={games} onGame={setGame} onMade={(id) => reload().then(() => { if (id) setGame(id) })} packages={packages} onBuild={(id) => { setPkg(id); setSpace('build') }} space={switcher} />
    : <PackageStudio key={pkg} pkg={pkg} packages={packages} games={games} onPackage={setPkg} onMadePackage={madePackage} space={switcher} />
}
