# ViralShort — Design System

Modern, Instagram/CapCut-quality UI. Violet accent, dark + light themes.

## Theme

Tokens live in [`app/src/theme/tokens.js`](app/src/theme/tokens.js); consume via
`useTheme()` from [`app/src/theme/ThemeContext.js`](app/src/theme/ThemeContext.js).
Mode is **System / Dark / Light** (toggle in Profile → Appearance), persisted.

| Token | Dark | Light |
|-------|------|-------|
| bg | `#0A0A0B` | `#FFFFFF` |
| surface | `#161618` | `#F7F7FA` |
| card | `#1C1C1F` | `#F1F1F5` |
| border | `#262628` | `#E5E5EA` |
| text | `#FFFFFF` | `#0A0A0B` |
| textMuted | `#8E8E93` | `#6B6B70` |
| **primary (accent)** | `#7C5CFF` | `#7C5CFF` |
| success / danger | `#2ECC71` / `#FF4D4F` | `#23A65A` / `#E0344B` |
| coin / diamond | `#F5C518` / `#5B8DEF` | `#C9A211` / `#2C82C9` |

**Spacing** 4/8/12/16/20/28 · **Radii** 8/12/16/30(pill) · **Type** h1 24/800, h2 18/800, body 15/500, label 13/700.

### Migrating a screen to the theme
```js
import { useTheme } from '../theme/ThemeContext';
function Screen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // ...jsx unchanged...
}
const makeStyles = (colors) => StyleSheet.create({ /* uses colors.* */ });
```

## Component patterns (from the reference mockups)
- **Bottom sheets** with a 40×4 grab handle (AudioPanel, TagPeopleModal, Comments, Gift, Diamond)
- **Segmented controls** — pill row, active = violet fill, white text (Appearance toggle, feed tabs)
- **Pill buttons** (radius 30) · circular **record FAB** with ring
- **Camera**: left/right icon rails, segmented multi-clip progress bar, violet shutter
- **Cards** radius 12–16, padding 16–20, 13px muted labels
- **Filmstrip** timeline + numbered selection badges

## Motion
- Sheet slide-up 250ms ease-out · tab/segment 150ms · record-ring pulse · selection scale-bounce · cover shared-element.

## Migration status (light mode)
- ✅ Themed (dark+light): nav chrome + tab bar, Create flow, Camera, Audio sheet,
  Drafts, Feed, Profile (+ toggle), shared Buttons/Fields.
- ⏳ Pending (still dark until migrated): Discover, Wallet/Leaderboard/Contest,
  Inbox/Chat, secondary sheets, VideoCard overlays. The violet accent already
  applies everywhere in dark mode.
