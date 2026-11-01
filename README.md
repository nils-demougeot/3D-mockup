# Merch Studio · mockups 3D pour ton asso

Site statique (hébergeable sur **GitHub Pages**) pour créer gratuitement des mockups 3D de merch, directement dans le navigateur.
Tu prépares tes visuels dans Figma à partir de gabarits, tu les importes (ou tu les colles) et tu les vois aussitôt sur un modèle 3D interactif, puis tu exportes une image HD.

## Produits disponibles

| Catégorie | Produit | Zones d'impression | Options |
|---|---|---|---|
| Textile | T-shirt | Devant, Cœur, Dos, Manche | 12 couleurs + couleur libre, flottant ou porté, tissu animé |
| Textile | Sweat à capuche | Devant, Cœur, Dos, Manche | cordons assortis/contrastés |
| Textile | Polo | Cœur, Dos, Devant droit, Manche | boutons |
| Textile | Casquette | Face avant, Côté, Arrière | classique / trucker (filet), **broderie 3D** ou impression, visière incurvée/plate, dessous de visière |
| Textile | Tote bag | Recto, Verso | couleur des anses |
| Goodies | Mug | Face avant, Face arrière, Tour complet | céramique / émaillé (camping), intérieur coloré, brillant/mat |
| Goodies | Gourde isotherme | Face avant, Dos, Tour complet | mat / brillant / inox brossé, **gravure laser**, bouchon bambou/inox/noir |
| Goodies | Stylo | Corps | brillant / soft touch / alu, garnitures, marquage quadri/blanc/gravure |
| Goodies | Porte-clé flamme | Recto, Verso | tissé / imprimé satin, anneau, surpiqûres |
| Goodies | Pin's | Visuel (contour automatique) | forme, 5 métaux, émail dur/mou/pailleté, bordure |
| Papeterie | Sticker | Visuel (découpe à la forme) | marge blanche, vinyle brillant/mat, **holographique**, pailleté, transparent, coin décollé ou posé sur un laptop |
| Packaging | Boîte welcome pack | Dessus, Face avant, Côtés, Arrière, Intérieur du couvercle, Fond | couvercle animé, kraft/blanc/noir/couleur, encre « multiply » sur kraft, papier de soie |

## Utilisation

1. Choisis un produit dans la barre du haut.
2. Sur une zone, clique **Gabarit** : un SVG aux bonnes dimensions (cm, px, dpi) est téléchargé. Glisse-le dans Figma : il devient un frame.
3. Dessine dans le groupe `TON DESIGN ICI`, masque le groupe `GUIDES`, puis :
   - exporte le frame en PNG et glisse-le sur la zone, **ou**
   - sélectionne le frame, `⇧⌘C` (*Copy as PNG*), clique sur la zone dans Merch Studio et `⌘V`.
4. Ajuste (glisser la vignette pour déplacer, molette ou curseur pour la taille, rotation), choisis couleurs et finitions.
5. **Exporter** : PNG HD avec fond, PNG transparent, ou planche 4 vues.

Astuces :
- **Ajouter mon logo** (en haut à droite) applique ton logo sur la zone principale de tous les produits d'un coup. `Maj` + clic pour le retirer.
- Stickers et pin's : utilise un PNG à **fond transparent**, la découpe et le contour métal suivent la forme.
- Raccourcis : `R` rotation automatique, `1`–`5` changer de vue.
- Tout est enregistré localement dans ton navigateur (IndexedDB) : rien n'est envoyé sur un serveur.
- Chaque produit a une URL directe : `…/#hoodie`, `…/#mug`, `…/#sticker`…

## Mise en ligne sur GitHub Pages

Aucune compilation n'est nécessaire, le site est 100 % statique.

1. Fusionne cette branche dans `main` (ou choisis directement cette branche à l'étape suivante).
2. Sur GitHub : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**.
3. Après une minute, le site est disponible sur `https://<ton-compte>.github.io/<nom-du-repo>/`.

## Lancer en local

Les modules ES nécessitent un petit serveur HTTP (ouvrir `index.html` en `file://` ne fonctionne pas) :

```bash
python3 -m http.server 8000
```

Puis ouvre http://localhost:8000.

## Technique

- [Three.js](https://threejs.org) r187, copié dans `vendor/three` (aucune dépendance externe à l'exécution, à part la police Inter).
- **T-shirt, sweat, polo et tote bag** viennent d'une vraie **simulation de tissu** (Blender) : patrons cousus, drapés par la gravité sur un mannequin MakeHuman (CC0), puis soufflés par du vent. Les poses sont enregistrées dans `assets/models/*.glb` (morph targets) et rejouées en boucle dans le navigateur. Option « Porté » sur buste de vitrine. Scripts de génération dans `tools/blender/`.
- Les autres objets sont **générés par le code** :
  - objets de révolution (mug, gourde, stylo, bouchon) par profils lissés ;
  - stickers et pin's : contour extrait de la transparence de l'image (distance euclidienne + marching squares) puis extrudé ;
  - casquette : surface paramétrique 6 panneaux, logo projeté (décalcomanie) avec relief de broderie calculé depuis l'image.
- Rendu : éclairage studio (environnement + lumière principale qui suit la caméra), tone mapping « Khronos PBR Neutral » pour des couleurs fidèles, ombre de contact douce.

```
index.html          interface
css/style.css       styles
js/app.js           logique de l'interface (zones, import, collage, export, sauvegarde)
js/core/            moteur : visionneuse, géométrie, textures procédurales, matériaux, contours, gabarits
js/products/        un fichier par produit (zones, options, construction 3D)
vendor/three/       Three.js
```

### Ajouter un produit

Crée `js/products/mon-produit.js` qui exporte un objet `{ id, name, category, colors, defaultColor, zones, options, views, create() }`.
`create()` renvoie `{ group, update(state), dispose() }` : `state.zones[id]` contient un canvas déjà composé (visuel placé dans la zone), `state.color` et `state.options` les réglages. Ajoute-le ensuite dans `js/products/index.js`.
