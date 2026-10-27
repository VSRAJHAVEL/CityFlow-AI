# Google Flow Creative Spec & Prompt Reference Guide
## Project: CityFlow AI — Autonomous Urban Mobility Dashboard Background

### 1. Design Philosophy & Core Aesthetics
CityFlow AI is a **VisionOS-inspired, reinforcement learning municipal cockpit**. The background wallpaper must satisfy three critical engineering and design principles:

1. **Ambient Non-Intrusiveness**:
   - The dashboard hosts high-density UI cards, live time-series charts, and a dynamic 60 FPS Canvas grid.
   - The background must serve as an atmospheric, deep-space substrate with **low visual noise** in the center and lower-middle quadrants, preventing interference with foreground text legibility.
2. **Cyber-Optic Aurora Identity**:
   - Ethereal, ribbon-like volumetric light beams resembling an electric violet and bioluminescent turquoise aurora borealis flowing over an ultra-dark cityscape.
3. **Photonic Architectural Micro-Grid**:
   - Subtle isometric or planar fiber-optic road networks and translucent skyscraper wireframes fading into atmospheric dark mist.

---

### 2. Exact Color Palette & Lighting Tokens

| Layer / Element | Hex Code | RGB / HSL | Role in Background Generation |
| :--- | :--- | :--- | :--- |
| **Deep Space Obsidian** | `#07080e` | `rgb(7, 8, 14)` | Substrate baseline; must occupy 60%+ of the frame |
| **Smoked Slate Vignette** | `#0d101c` | `rgb(13, 16, 28)` | Peripheral dark vignette and corner light dropoff |
| **Electric Iris Violet** | `#7c3aed` / `#c084fc` | `rgb(124, 58, 237)` | Primary volumetric aurora ribbon and top atmospheric luminescence |
| **Bioluminescent Cyber Mint** | `#00f5d4` / `#2dd4bf` | `rgb(0, 245, 212)` | Secondary light sweep, neon cyan fiber-optic road arteries |
| **Quantum Hyper-Emerald** | `#10f49c` | `rgb(16, 244, 156)` | Subtle sub-surface glow hints and park canopy accents |
| **Solar Amber (Micro-accent)**| `#ffd166` | `rgb(255, 209, 102)`| Distant point light reflections / architectural window specks |

---

### 3. Master Prompts for Google Flow / Imagen 3

#### Option A: Cinematic Photonic Aurora Grid (Recommended Primary)
```text
Cinematic wide-angle background wallpaper of a futuristic cybernetic metropolis at midnight, minimalist VisionOS aesthetic. Soft ethereal volumetric aurora ribbons in electric iris violet (#7c3aed) and bioluminescent cyber mint (#00f5d4) gracefully curving through a deep obsidian sky. Subtle translucent geometric glass skyscrapers below with delicate fiber-optic street lines glowing with soft light trails. Smooth dark atmospheric fog, deep black-blue background (#07080e), heavy peripheral vignette, clean negative space in the center for UI overlays. Ultra-clean 8k render, octane render, unreal engine 5 architectural visualization, shallow depth of field, tilt-shift bokeh, smooth gradients, no harsh glare, no text, no logos.
```

#### Option B: Abstract Quantum Waveform (Minimalist & Clean)
```text
Minimalist abstract 3D digital art wallpaper, undulating holographic light waves flowing like liquid silk across an infinite dark obsidian space. Dual color harmony of glowing vibrant ultraviolet (#c084fc) and neon turquoise (#00f5d4), glowing particles suspended in dark glass atmosphere. Soft ambient luminescence, high dynamic range, smooth noise-free dark background (#07080e), studio lighting, cinematic luxury tech wallpaper, designed specifically as an enterprise dashboard background with extensive center dark negative space.
```

#### Option C: Aerial Autonomous Grid Network (Top-Down / Tilt-Shift)
```text
High-angle aerial orthographic view of an abstract smart city grid at night, interconnected laser network routes in cyan teal and violet glowing softly along dark asphalt corridors. Low-poly translucent crystalline architectural blocks with subtle interior glow, covered in dark atmospheric haze. Deep black substrate, high contrast, elegant dark aesthetic, soft focus falloff towards the edges, premium tech presentation background, clean, minimalist, no typography.
```

---

### 4. Negative Prompt (Critical Guards)
```text
text, watermark, typography, letters, logo, numbers, daylight, bright sun, oversaturated yellow, red haze, chaotic explosions, clutter, messy wires, cartoon, illustration, low resolution, noisy texture, JPEG artifacts, harsh white glare, cars with readable plates, people, faces, crowded composition
```

---

### 5. Google Flow Parameter Settings
- **Aspect Ratio**: `16:9` (1920×1080 / 3840×2160) or `21:9` (3440×1440) for ultrawide displays.
- **Lighting Model**: Volumetric light, subsurface scattering, ambient ray-tracing.
- **Color Grading**: Cool cybernetic dark mode, violet-cyan duotone with obsidian base.
- **Render Style**: 3D Digital Art / Architectural Tech Visualization.
