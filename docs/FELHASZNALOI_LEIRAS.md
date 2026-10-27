# FormJet – felhasználói leírás

A FormJet a SharePoint listák űrlapját váltja ki: ezen keresztül veszel fel új elemet, szerkeszted vagy megnézed a meglévőket. Az űrlap elrendezését a webhely adminisztrátora állítja be, ezért listánként más mezőket, csoportokat és színeket láthatsz.

Ez a leírás két részből áll:

- **Az űrlap használata** – mindenkinek, aki elemeket vesz fel vagy szerkeszt.
- **Az űrlap megtervezése** – a webhely adminisztrátorainak, akik az elrendezést állítják be.

## Tartalom

1. [Az űrlap használata](#1-az-űrlap-használata)
2. [A mezők kitöltése](#2-a-mezők-kitöltése)
3. [Mentés](#3-mentés)
4. [Az űrlap megtervezése](#4-az-űrlap-megtervezése)
5. [Elrendezés: szekciók és mezők](#5-elrendezés-szekciók-és-mezők)
6. [Egy mező beállításai](#6-egy-mező-beállításai)
7. [Feltételek](#7-feltételek)
8. [Megjelenés (stílus)](#8-megjelenés-stílus)
9. [Kapcsolódó elemek egy másik listából](#9-kapcsolódó-elemek-egy-másik-listából)
10. [Tudnivalók és korlátok](#10-tudnivalók-és-korlátok)
11. [Gyakori kérdések](#11-gyakori-kérdések)

---

## 1. Az űrlap használata

Az űrlap három helyzetben jelenik meg:

| Mikor | Mit látsz |
| --- | --- |
| Új elem felvétele | Üres űrlap, a beállított kezdőértékekkel. |
| Meglévő elem szerkesztése | Az elem mentett értékei, szerkeszthető mezőkkel. |
| Elem megtekintése | Az elem értékei, szerkesztés nélkül. |

Ugyanaz a mező a három helyzetben másképp viselkedhet: lehet, hogy új elemnél nem látszik, szerkesztéskor csak olvasható, vagy csak bizonyos értékek mellett jelenik meg. Ezt az adminisztrátor állítja be, nem hiba.

Az űrlap csoportokra (szekciókra) tagolódik. A lefelé mutató nyíllal jelölt szekciók a címükre kattintva becsukhatók és kinyithatók.

A csillaggal (`*`) jelölt mezők kitöltése kötelező.

## 2. A mezők kitöltése

### Szöveg és formázott szöveg

Az egysoros és a többsoros szövegmezőbe egyszerűen gépelhetsz. A formázott szövegmező fölött eszköztár van: félkövér, dőlt, aláhúzott, áthúzott, címsor, felsorolás, számozott lista, hivatkozás, formázás törlése, visszavonás.

### Szám, pénznem, százalék

- A tizedesjelet a webhely beállítása szerint írd (magyar webhelyen vesszővel: `12,5`).
- Pénznemnél a mező szélén látszik a pénznem jele (például `Ft`); ezt nem kell beírnod.
- Százalékos mezőbe a százalékértéket írd (`25`), a `%` jel a mező szélén látszik.

### Választás

Egy érték esetén legördülő listából vagy választógombok közül választasz, attól függően, hogy a SharePoint oszlop beállításainál melyik megjelenítés van megadva. Több érték esetén jelölőnégyzeteket látsz, ezekből többet is bejelölhetsz.

Ha az oszlopnál saját érték beírása is engedélyezett, mindig legördülő listát kapsz, amelybe gépelni is lehet. A kiválasztott választógomb nem törölhető, csak másikra cserélhető.

### Igen / Nem

Kapcsolóval állítható.

### Dátum és idő

- A naptár ikonra kattintva választhatsz napot, vagy be is gépelheted a dátumot.
- Ha a mező időt is tárol, a dátum mellett időválasztó van, 5 perces lépésekkel. Az időt be is gépelheted (például `14:30`). Időt csak akkor tudsz választani, ha már van dátum.

### Személy vagy csoport

Kezdd el gépelni a nevet vagy az e-mail-címet, és válassz a találatok közül. Ha a mező több személyt enged, egymás után többet is felvehetsz. A kiválasztott személy a neve melletti `×`-szel távolítható el.

### Keresőmező (másik lista eleme)

Egy érték esetén legördülő listából választasz. Több érték esetén – a beállítástól függően – vagy egy mindig nyitott jelölőnégyzetes listát, vagy egy több elem bejelölését engedő legördülő listát látsz.

### Felügyelt metaadat (kifejezés)

Kattints a mezőbe: megjelenik a választható kifejezések eleje. Gépeléssel szűkítheted a listát. A javaslatokban a kifejezés teljes útvonala látszik (például `Európa > Magyarország > Budapest`).

### Hivatkozás

Két mező tartozik hozzá: a **webcím** (`https://…`) és a **megjelenő szöveg**. Ha a megjelenő szöveget üresen hagyod, maga a cím jelenik meg.

### Hely

- Gépelj be egy helynevet vagy címet, és válassz a találatok közül.
- Ha nincs megfelelő találat, a lista alján a beírt szöveget is kiválaszthatod helyként (például „Nagy tárgyaló”).
- A címke melletti térkép ikon a kiválasztott helyet egy felugró térképen mutatja.

### Kép

A **Kép hozzáadása** gombbal választhatsz képfájlt; azonnal megjelenik az előnézete. Meglévő képnél **Csere** és **Törlés** gomb van. A kép az űrlap mentésekor töltődik fel.

### Mellékletek

- A **Fájlok hozzáadása** gombbal vagy a fájlok mezőre húzásával csatolhatsz. Egyszerre több fájl is felvehető.
- A képekről kis előnézet látszik, minden fájl mellett ott a mérete.
- A meglévő mellékletek a nevükre kattintva új lapon nyílnak meg, a kuka ikonnal törölhetők.
- A hozzáadás és a törlés is csak az űrlap mentésekor történik meg; addig a **Mégse** mindent eldob. A törölt melléklet a webhely lomtárába kerül.

## 3. Mentés

- **Mentés:** elmenti az elemet és bezárja az űrlapot.
- **Mégse:** mentés nélkül bezár.

Mentéskor a következőkkel találkozhatsz:

| Mit látsz | Mit jelent | Mit tegyél |
| --- | --- | --- |
| „A mező kitöltése kötelező.” egy mező alatt | Egy kötelező mező üres. | Töltsd ki, majd ments újra. |
| Hibaüzenet egy mező alatt mentés után | A SharePoint nem fogadta el az értéket (például rossz formátum). | Javítsd a jelzett mezőt. Amíg hiba van, semmi nem mentődik. |
| „Az elemet időközben módosították” | Valaki más mentette az elemet, mióta megnyitottad. | **Felülírás:** a te módosításaid érvényesülnek. **Újratöltés:** betölti a friss állapotot, a módosításaid elvesznek. |
| „Az elem mentése sikerült, de ezeknél a mellékleteknél hiba történt…” | Az elem mentve van, de egy vagy több melléklet nem. | A **Mentés** gombbal csak a mellékleteket próbálja újra. A **Mégse** bezárja az űrlapot (az elem mentve marad). |
| „A kép feltöltése nem sikerült, ezért az elem nem lett mentve.” | A kép feltöltése megakadt, ezért semmi nem mentődött. | Próbáld újra, vagy válassz másik képet. |

Ha szerkesztéskor semmin nem változtattál, a **Mentés** egyszerűen bezárja az űrlapot.

---

## 4. Az űrlap megtervezése

*Ez a rész a webhely adminisztrátorainak szól.*

Az űrlap jobb felső sarkában lévő **Tervező** kapcsolót csak a webhely adminisztrátorai látják. Bekapcsolva az űrlap két részre oszlik:

- **Balra az előnézet:** pontosan azt mutatja, amit a felhasználók látni fognak. A rejtett szekciók és mezők halványan látszanak, hogy szerkeszteni tudd őket.
- **Jobbra a tervező panel:** mindig a **kijelölt elem** (az űrlap, egy szakasz vagy egy mező) beállításait mutatja. A panel az ablak jobb széléhez rögzített és teljes magasságú: az oldal görgetésekor a helyén marad, a hosszabb tartalmát a saját görgetősávjával éred el. Keskeny ablakban az előnézet alá kerül.

Az előnézet fölötti **Előnézet módja** választóval megnézheted, hogyan fest az űrlap új elemnél, szerkesztéskor és megtekintéskor. Az előnézet mezőibe írhatsz is, így a feltételek hatását azonnal kipróbálhatod.

### Az űrlap gombjai (alsó gombsor)

Az űrlap tulajdonságai között, **Az űrlap gombjai** résznél állítható, milyen gombok vannak az űrlap alján.

**Beépített gombok.** Amíg nem szabod testre, a **Mentés típusa** szerinti beépített gombok látszanak (lásd lent).

**Testreszabás.** A **Gombok testreszabása** gombbal a beépített gombok rendes gombként kerülnek az elrendezésbe, ugyanazzal a működéssel. Ezután:

- a gombok listájában a nevükre kattintva kijelölheted őket (az előnézet alatt is látszanak, ott kattintással is kijelölhetők);
- mindegyiknek állítható a felirata (feltételtől függően is), az ikonja, a **Kiemelt (elsődleges) gomb** jelölő, a *Látható, ha* és a *Letiltva, ha* feltétel, a stílusa és a műveletei – pontosan úgy, mint a szakaszokba tehető gomboknál (lásd [Gomb elhelyezése az űrlapon](#gomb-elhelyezése-az-űrlapon));
- a nyilakkal átrendezheted, a kuka ikonnal törölheted őket, a **Gomb hozzáadása** gombbal újat vehetsz fel (például „Submit”: Status = Submitted, majd Mentés és bezárás);
- a **Vissza a beépített gombokra** gomb visszaállítja a beépített gombokat (a testreszabott gombok törlődnek).

A beépített Mentés gomb megtekintéskor nem látszik, a Mégse felirata megtekintéskor „Bezárás” – a testreszabott gombok is így indulnak, feltételként beállítva.

**Példa (a régi űrlap Submit gombja):** felirat „Submit”, *Látható, ha*: `Változó: SavedStatus` = Draft ÉS `Változó: InCountryGroup` = Igen; műveletek: Mező értékének beállítása – Status – Submitted, majd Mentés és bezárás.

### Mentés típusa

A **Mentés típusa** (a beépített gombsornál) határozza meg, milyen gombok vannak az űrlap alján:

- **Alapértelmezett:** **Mentés** (ment és bezárja az űrlapot) és **Mégse**.
- **Bővített:** **Mentés** (ment, de az űrlap nyitva marad), **Mentés és bezárás**, valamint **Mégse**. Sikeres mentés után az űrlap tetején „A módosítások mentve.” üzenet jelenik meg, és az űrlap a mentett adatokkal frissül.

Bővített mentésnél új elem felvételekor az első Mentés létrehozza az elemet, és az űrlap ettől kezdve ennek az elemnek a szerkesztéseként folytatódik (a további mentések ugyanazt az elemet frissítik, nem jön létre másolat). Ilyenkor az „új elem” módhoz kötött beállítások helyett a szerkesztéshez kötöttek érvényesek. Ha mentés után a Mégse gombbal zárod be az űrlapot, a már elmentett módosítások megmaradnak.

A gombok műveletei között a **Mentés és bezárás** lépés ment és bezár, a **Mentés (az űrlap nyitva marad)** lépés ment, és az űrlap nyitva marad (ugyanúgy, mint a bővített Mentés gomb).

### Kijelölés

- **Az űrlap:** az előnézet fölötti **Űrlap beállításai** gombbal.
- **Egy szakasz:** a szakasz jobb felső sarkában, a fogantyú mellett lévő **fogaskerék** ikonnal.
- **Egy mező (felirat, gomb):** a mező fogaskerekével, vagy egyszerűen a mezőre kattintva.
- A kijelölt elem kék keretet kap. A panel tetején lévő útvonal (például *Űrlap › Beszerzés › Összeg*) mutatja, hol jársz; egy elemére kattintva egy szinttel feljebb lépsz.

A panel részei:

- **Nem elhelyezett mezők:** mindig látható, összecsukható sáv a panel tetején; innen húzhatod a mezőket az előnézetbe, bármi legyen is kijelölve.
- **Tulajdonságok** fül: a kijelölt elem beállításai (lásd lent).
- **Stílus** fül: a kijelölt elem megjelenése (lásd [8. fejezet](#8-megjelenés-stílus)).
- Az űrlap kijelölésénél ezeken felül: **Változók** és **JSON** fül.

Az **űrlap** tulajdonságai: az űrlap címe, a **Mentés típusa** (lásd lent), a **Feltétel több mezőre…** gomb, **Az űrlap felépítése** (fa nézet: a szakaszok és alattuk a mezőik; bármelyikre kattintva kijelölheted), és az **Új szakasz** gomb.

### Mentés és elvetés

- **Elrendezés mentése:** a módosítások ettől kezdve minden felhasználónak érvényesek.
- **Mégse** (vagy a Tervező kapcsoló kikapcsolása): minden nem mentett módosítás elvész.

Amíg nem mentesz, a változtatásaidat csak te látod.

Az elrendezés listánként (pontosabban a lista tartalomtípusonként) külön tárolódik. Ahol még nincs mentett elrendezés, ott az összes mező egy szekcióban, egymás alatt jelenik meg.

### A FormJet bekapcsolása egy listán

Azt, hogy egy listán a FormJet űrlap vagy a SharePoint beépített űrlapja nyíljon meg, a **FormJet beállítása** webparton lehet megadni. A webhely tulajdonosa használhatja.

1. Szerkessz egy oldalt a webhelyen, és vedd fel rá a **FormJet beállítása** webpartot.
2. A **Listák** táblázatban a webhely listái láthatók, tartalomtípusonként egy sorban. Az **Űrlap** oszlop mutatja, mi nyílik meg most.
3. A sor végén lévő kapcsolóval kapcsold be vagy ki a FormJet űrlapot. A változás azonnal érvényes, mindhárom helyzetre (új elem, szerkesztés, megtekintés).

Kikapcsoláskor a lista visszaáll a SharePoint beépített űrlapjára; a mentett elrendezés megmarad, és újbóli bekapcsoláskor ismét érvényes.

### Menüpontok a lista helyi menüjében

A lista elemeinek helyi menüjébe (az elem melletti … menü, illetve jobb kattintás) saját menüpontok tehetők, amelyek a kijelölt elemen végeznek el valamit, például átállítják a státuszát, módosítják egy másik lista kapcsolódó elemeit, vagy új elemet vesznek fel egy másik listába.

**Beállítás** (webhelytulajdonosként, a **FormJet beállítása** webparton):

1. A **Listák** táblázatban a lista sorában kattints a **Menüpontok…** gombra. Oldalt megnyílik a lista menüpontjainak szerkesztője.
2. A **Menüpont hozzáadása** gombbal vegyél fel menüpontot (listánként legfeljebb 10), és add meg:
   - **Felirat:** ez látszik a menüben.
   - **Látható, ha:** feltétel a kijelölt elem értékeire (például Status = Új), a csoporttagságra vagy arra, hogy a felhasználó az elem létrehozója-e. Üresen mindig látszik.
   - **Megerősítő kérdés** és **Üzenet sikeres futás után:** üresen általános szöveg jelenik meg.
   - **Lépések:** sorban, egymás után futnak le (lásd lent).
3. Kattints a **Mentés** gombra. Ekkor a FormJet menü a listára kerül; ha minden menüpontot törölsz és mentesz, lekerül róla.

**Lépések:**

| Lépés | Mit csinál |
| --- | --- |
| A kijelölt elem mezőjének beállítása | A kijelölt elem kiválasztott mezőjébe beírja az értéket. |
| Egy másik lista egyező elemeinek módosítása | Egy másik lista **minden** olyan elemét módosítja, amelynek a megadott mezője megegyezik a kijelölt elem megadott mezőjével (például a rendelés azonosítójával), és beállítja bennük a megadott mezőket. |
| Új elem felvétele egy listába | Új elemet vesz fel a kiválasztott listába a megadott mezőértékekkel. |

Az értékek megadásánál minden értéknél választható **Az érték forrása**:

- **Megadott érték:** konstans (például `Áttekintés alatt`), `[today]` (a mai nap), `[me]` (az, aki a menüpontot futtatja), vagy szövegbe ágyazva a kijelölt elem egy mezője kapcsos zárójelben, például `Áttekintés: {Title}`.
- **A kijelölt elem mezője:** a kijelölt elem egy oszlopa listából választva (az azonosító, ID is). A mező értéke változatlanul kerül át, így személy, keresőmező vagy dátum is másolható.

**Használat:** jelölj ki **egy** elemet a listában, nyisd meg a helyi menüjét, és válaszd a menüpontot. A megerősítés után a lépések lefutnak, a végén üzenet jelzi, hány mező, illetve elem módosult és hány új elem jött létre; bezáráskor a lista frissül. Ha egy lépés nem sikerül (például hiányzik egy kötelező mező vagy nincs jogod), a futás megáll, és hibaüzenet jelenik meg; a már elvégzett lépések megmaradnak.

A menüpont elrejtése nem jogosultsági védelem: a lépések a futtató felhasználó nevében, az ő jogaival futnak.

A webpart **Konfigurációs lista** része azt a listát mutatja, amelyben az elrendezések tárolódnak. Ha még nincs meg, a **Lista létrehozása** gombbal létrehozható (az első elrendezés mentésekor magától is létrejön). A **Csak olvasás a tulajdonosokon kívül** gombbal beállítható, hogy az elrendezéseket és a menüpontokat csak a tulajdonosok és a webhelygazdák módosíthassák; mindenki más, aki eddig szerkeszthette a listát, csak olvasni tudja. Ezt érdemes megtenni.

## 5. Elrendezés: szekciók és mezők

### Áthelyezés húzással

Tervező módban minden szekció és mező jobb felső sarkában megjelenik egy kis fogantyú (pöttyös ikon). Ennél fogva:

- a **mezők** szekción belül átrendezhetők, és másik szekcióba is áthúzhatók;
- a **szekciók** egymáshoz képest átrendezhetők.

Az üres szekció „Húzz ide egy mezőt” feliratú területként látszik. Billentyűzettel is működik: a fogantyún szóköz, nyilak, majd újra szóköz; az Esc megszakítja.

### Új mező felvétele

A panel tetején lévő **Nem elhelyezett mezők** sávban azok a mezők láthatók, amelyek még nem szerepelnek az űrlapon. Kétféleképp veheted fel őket:

- húzd a mező címkéjét az előnézet egy szekciójára (egy mezőre ejtve elé kerül, a szekció üres részére ejtve a végére);
- vagy jelöld ki a szakaszt, és a tulajdonságai között a **Mező hozzáadása…** listából válaszd ki.

Ami nincs egyetlen szekcióban sem, az nem jelenik meg az űrlapon. A **mellékletek** is így vehetők fel: a mentett elrendezésekben a nem elhelyezett mezők között találod.

### Felirat elhelyezése az űrlapon

Az űrlapra olyan szöveg (felirat) is tehető, amely mögött nincs SharePoint oszlop: például útmutató, figyelmeztetés vagy magyarázat. Feliratból bármennyi felvehető.

1. Jelöld ki azt a szakaszt, amelybe a feliratot szánod, és a tulajdonságai alján (a **Mező hozzáadása…** lista alatt) kattints a **Felirat hozzáadása** gombra.
2. A felugró ablakban add meg, hogyan hívod a feliratot (például „Kitöltési útmutató”), majd kattints a **Felirat hozzáadása** gombra (vagy nyomj Entert). A megnevezés csak a tervezőben látszik, az űrlapon nem. A felirat a szakasz végére kerül, és ki is jelölődik, így a tulajdonságai azonnal szerkeszthetők.
3. A **Tartalom** mezőbe írd be az űrlapon megjelenő szöveget. Sima szöveg, formázás nélkül; a sortörések megmaradnak.
4. A **Látható ezekben a módokban** jelölőkkel add meg, hogy új elemnél, szerkesztéskor és megtekintéskor látszódjon-e; a **Látható, ha** feltétellel mezőértékhez is kötheted.

A felirat ezután ugyanúgy viselkedik, mint egy mező: húzással áthelyezhető, a szakasz tulajdonságai között állítható a szélessége, és a **Stílus** fülön háttérszínt, keretet és betűszínt kaphat. Az útvonalban és a fa nézetben a megnevezésével szerepel.

Egy felirat egyszer helyezhető el. Ha kiveszed a szekcióból, a nem elhelyezett mezők közé kerül; végleg a tulajdonságai között lévő **Felirat törlése** gombbal törölhető. A felirat csak megjelenik: a listába semmit nem ment, és feltételben nem lehet rá hivatkozni.

### Gomb elhelyezése az űrlapon

A gomb kattintásra vagy a beállított műveleteket hajtja végre (például beállít egy mezőt, majd ment), vagy egy webcímet nyit meg, például egy súgóoldalt, egy kapcsolódó listát vagy egy e-mail-címet.

1. A kijelölt szakasz tulajdonságainak alján kattints a **Gomb hozzáadása** gombra, és a felugró ablakban add meg a gomb feliratát. Ez a felirat látszik a gombon.
2. A **Felirat** melletti elágazás ikonú gombbal a felirat feltételtől függően is változhat (ugyanúgy, mint a mező címkéjénél). A **Kiemelt (elsődleges) gomb** jelölővel a gomb kék, kiemelt gomb lesz. Az **Ikon** mezőben megadhatsz egy Fluent UI ikonnevet (például `Save`, `Send`, `Accept`, `Mail`); az ikon a felirat előtt jelenik meg, és a mező mellett előnézetben is látszik.
3. A **Műveletek beállítása** gombbal állíthatod össze, mit csináljon a gomb (lásd lent). Ha nincs művelet, a gomb a webcímet nyitja meg.
4. A gomb tulajdonságai között add meg a **Webcím (URL)** értékét: `http://` vagy `https://` kezdetű cím, `mailto:` cím, vagy a webhelyen belüli cím (például `/sites/beszerzes/Lists/Szallitok`). Más cím nem nyitható meg; ilyenkor a mező alatt hibaüzenet jelenik meg. A **Megnyitás új lapon** jelölővel a cím új böngészőlapon nyílik meg.
5. A **Látható ezekben a módokban** és a **Látható, ha** beállítással adod meg, mikor látszik a gomb; a **Letiltva ezekben a módokban** és a **Letiltva, ha** beállítással pedig azt, mikor szürke és nem kattintható.

A gomb megtekintéskor is használható. A **Stílus** fülön beállított háttér, keret és betűszín magára a gombra vonatkozik. A tervező előnézetében a gomb nem csinál semmit, a kattintás csak kijelöli. A gomb végleg a tulajdonságai között lévő **Gomb törlése** gombbal törölhető.

#### A gomb műveletei

A **Műveletek beállítása** gomb felugró ablakában lépéseket veszel fel (**Lépés hozzáadása**), és mindegyiknél kiválasztod a műveletet:

| Művelet | Mit csinál |
| --- | --- |
| Mező értékének beállítása | A kiválasztott mezőbe beírja a megadott értéket. Választás mezőnél a mező értékei közül választasz (több választásnál többet is), igen/nem mezőnél Igen vagy Nem közül; más mezőnél az érték formátuma ugyanaz, mint a kezdőértéknél (dátumnál `[today]`, személynél `[me]` is). |
| Mentés és bezárás | Elmenti az űrlapot (a kötelező mezők ellenőrzésével), és sikeres mentés után bezárja. |
| Mentés (az űrlap nyitva marad) | Elmenti az űrlapot, de nyitva hagyja; új elemnél az űrlap a létrehozott elem szerkesztésével folytatódik. |
| Bezárás mentés nélkül | Bezárja az űrlapot, a módosítások elvesznek. |

- A lépések **sorrendben, egymás után** futnak le: a következő csak az előző befejezése után indul, így a mentés már a frissen beállított értékekkel történik. A sorrend a lépés fejlécében lévő nyilakkal változtatható.
- A **Mentés** és a **Bezárás** lezárja a sort: utánuk nem fut le több lépés (a felugró ablak ezt figyelmeztetéssel jelzi). Ha a mentés nem sikerül (például hiányzik egy kötelező mező), az űrlap nyitva marad, és a hibák a szokott módon látszanak.
- A gomb által beállított érték akkor is elmentődik, ha a mező az űrlapon **rejtett vagy csak olvasható** – így például egy rejtett „Állapot” mező is „Jóváhagyva”-ra állítható. (Minden más esetben az űrlap csak a látható, szerkeszthető mezőket menti.) A SharePointban eleve nem írható mezők (például Létrehozva) és a mellékletek, képek nem választhatók.
- Futás közben a gomb le van tiltva, így véletlenül sem indul el kétszer.
- Megtekintéskor csak a Bezárás fut le (megtekintéskor nincs mit menteni).

**Példa:** „Jóváhagyás” gomb. 1. lépés: Mező értékének beállítása – Állapot – `Jóváhagyva`; 2. lépés: Mező értékének beállítása – Jóváhagyás dátuma – `[today]`; 3. lépés: Mentés.

### A szekció beállításai

Jelöld ki a szakaszt a fogaskerekével (vagy a fa nézetben); a **Tulajdonságok** fülön ezek állíthatók:

| Beállítás | Jelentés |
| --- | --- |
| Cím, Leírás | A szekció fejléce és az alatta megjelenő rövid szöveg. A mellettük lévő elágazás ikonú gombbal feltételtől függő érték is megadható, ugyanúgy, mint a mező címkéjénél (lásd [6. fejezet](#feltételtől-függő-címke-leírás-helykitöltő-és-kezdőérték)); üres értékű szabállyal a cím és a leírás el is tüntethető. |
| Oszlopok száma | 1–4. Ennyi mező fér egymás mellé; keskeny képernyőn a mezők egymás alá kerülnek. |
| Becsukható, Alapból csukva | A felhasználó becsukhatja-e a szekciót, és csukva nyíljon-e meg. |
| Látható ezekben a módokban | Új elem / Szerkesztés / Megtekintés. |
| Látható, ha | Feltétel, amely mellett a szekció megjelenik (lásd [Feltételek](#7-feltételek)). |
| Letiltva, ha | Feltétel, amely mellett a szakasz minden mezője csak olvasható, a gombjai pedig nem kattinthatók. A mezők saját „Csak olvasható” beállítása ettől függetlenül érvényes. |
| Kapcsolódó elemek… | Egy másik lista elemeinek felsorolása (lásd [9. fejezet](#9-kapcsolódó-elemek-egy-másik-listából)). |

A tulajdonságok tetején lévő nyilakkal a szakasz mozgatható, a kuka ikonnal törölhető. Törléskor a mezői nem vesznek el, hanem a nem elhelyezett mezők közé kerülnek, és a kijelölés az űrlapra ugrik.

A szekció mezőinek listájában mezőnként beállítható a **szélesség** (hány oszlopot foglaljon el), és a mező eltávolítható a szakaszból. A mező nevére kattintva a mezőt jelölöd ki.

Az űrlap tulajdonságai között lévő **Új szakasz** gomb az űrlap végére vesz fel egy szakaszt, és ki is jelöli.

## 6. Egy mező beállításai

Jelöld ki a mezőt (kattints rá az előnézetben, a fogaskerekére, vagy a fa nézetben a nevére); a **Tulajdonságok** fülön ezek állíthatók:

| Beállítás | Jelentés |
| --- | --- |
| Címke | A mező felirata. Üresen hagyva a SharePoint oszlop neve látszik. |
| Leírás | A mező alatt megjelenő segítő szöveg. |
| Helykitöltő szöveg | Az üres mezőben halványan megjelenő szöveg. |
| Kezdőérték új elemnél | Új elemnél ezzel az értékkel indul a mező. Felülírja a SharePointban beállított alapértéket. |
| Látható ezekben a módokban | Melyik helyzetben jelenjen meg a mező. |
| Csak olvasható ezekben a módokban | Melyik helyzetben ne lehessen szerkeszteni. |
| Kötelező ezekben a módokban | Melyik helyzetben legyen kötelező. |
| Látható, ha / Csak olvasható, ha / Kötelező, ha | Feltételek (lásd [7. fejezet](#7-feltételek)). |

Egyes mezőtípusoknál további beállítás is megjelenik:

- **Több értékű keresőmező – A választható elemek megjelenítése:** mindig nyitott jelölőnégyzetes lista, lenyíló lista, vagy automatikus (legfeljebb 8 választható elemnél jelölőnégyzetes lista, efelett lenyíló).
- **Mellékletek – A mellékletek megjelenítése:** lista (soronként egy fájl) vagy tömör (egymás mellett).

### A kezdőérték megadása

| Mezőtípus | Mit írj be | Példa |
| --- | --- | --- |
| Szöveg, választás | Maga az érték | `Irodaszer` |
| Szám, pénznem | A webhely tizedesjelével | `12,5` |
| Százalék | A százalékérték | `25` |
| Igen / Nem | `1` (igen) vagy `0` (nem) | `1` |
| Több választás | Az értékek `;#` jelek között | `;#A;#B;#` |
| Dátum | `[today]` a mai naphoz, vagy egy dátum a webhely formátumában | `[today]` |
| Személy | `[me]` az űrlapot éppen kitöltő felhasználóhoz, vagy egy e-mail-cím; több személyt fogadó mezőnél pontosvesszővel elválasztva több is megadható | `[me]` vagy `anna@contoso.com; [me]` |

Személy mezőnél a beírt e-mail-címet a SharePoint a mentéskor keresi meg. Ha a cím nem létező felhasználóé, a kitöltő a mentéskor hibaüzenetet kap ennél a mezőnél, ezért a beállítás után érdemes egy próbaelemmel ellenőrizni.

### Feltételtől függő címke, leírás, helykitöltő és kezdőérték

A Címke, a Leírás, a Helykitöltő szöveg és a Kezdőérték új elemnél mező mellett egy elágazás ikonú gomb áll. Ezzel adhatod meg, hogy bizonyos feltétel esetén más legyen az érték, mint amit a mezőbe írtál.

1. Kattints a gombra: felugró ablak nyílik.
2. A **Szabály hozzáadása** gombbal vegyél fel egy szabályt.
3. A **Ha** résznél állítsd össze a feltételt (ugyanúgy, mint a láthatóságnál, lásd [7. fejezet](#7-feltételek)), alatta pedig írd be, mi legyen ilyenkor az érték.
4. Zárd be az ablakot. A változás az előnézetben azonnal látszik.

Tudnivalók:

- Több szabálynál **az első olyan érvényes, amelynek a feltétele teljesül**; a sorrend a szabály fejlécében lévő nyilakkal változtatható. Ha egyik sem teljesül, a mezőbe írt érték marad.
- Ha egy beállításnak van szabálya, a gomb kék, és egy kis szám mutatja, hány szabály tartozik hozzá.
- A címke, a leírás és a helykitöltő kitöltés közben is azonnal követi a feltételt. Üres értékű szabállyal a leírás és a helykitöltő el is tüntethető.
- A **kezdőérték** szabályai csak egyszer értékelődnek ki, amikor az űrlap új elemhez megnyílik; itt főleg a csoporttagságra épülő feltételnek van értelme (például más kezdőérték a Jóváhagyóknak). Az érték formátuma ugyanaz, mint a kezdőértéknél (lásd lent).

**Példa:** a „Megnevezés” mező címkéje legyen „Eszköz neve”, ha a kategória Informatika. A Címke melletti gombnál vegyél fel egy szabályt: `Kategória` – `egyenlő` – `Informatika`, akkor: `Eszköz neve`.

### A kötelezőségről

A kötelezőség csak szigorítható. Ha egy oszlop a SharePointban kötelező, az űrlapon nem tehető opcionálissá; fordítva viszont egy nem kötelező oszlop az űrlapon kötelezővé tehető.

## 7. Feltételek

Feltétellel azt adod meg, hogy egy szekció vagy mező mikor látszódjon, mikor legyen csak olvasható, illetve kötelező. A feltétel az űrlap **éppen beírt** értékeit figyeli, tehát kitöltés közben azonnal hat.

### Feltétel összeállítása

1. Kattints a **Feltétel hozzáadása** gombra.
2. Válaszd ki a **mezőt**, amelynek az értékétől függ.
3. Válaszd ki az **összehasonlítást**.
4. Add meg az **értéket**. Választás mezőnél listából választhatsz, igen/nem mezőnél Igen vagy Nem közül.

Több feltételnél megjelenik egy választó: **Minden feltétel teljesül** vagy **Bármelyik feltétel teljesül**.

**Csoportok.** A **Csoport hozzáadása** gombbal a feltételek közé egy csoport kerül, saját „Minden / Bármelyik” választóval és saját feltételekkel; csoportba újabb csoport is tehető (legfeljebb három szintig). Így összetett szabályok is összerakhatók, például: *bármelyik* teljesüljön ezek közül: (*minden* teljesül: (Sales admin – Albánia VAGY Marketing manager – Albánia) ÉS Country = ALBANIA), (*minden* teljesül: (… Bosznia …) ÉS Country = BOSNIA-HERZEGOVINA), … A feltételek között kiírt **ÉS** / **VAGY** mutatja, hogy az adott szinten mi a kapcsolat. **Példa:** „(A ÉS B) VAGY (C ÉS D)”: a legfelső szinten válaszd a *Bármelyik feltétel teljesül* lehetőséget, majd vegyél fel két csoportot (ezek maguktól *Minden feltétel teljesül* kapcsolattal indulnak), az egyikbe A-t és B-t, a másikba C-t és D-t. A csoportot a fejlécében lévő X törli. A tagadást (*not*) tartalmazó feltétel továbbra is csak JSON-ként szerkeszthető.

| Összehasonlítás | Mikor teljesül |
| --- | --- |
| egyenlő / nem egyenlő | Az érték megegyezik, illetve eltér. A kis- és nagybetű nem számít. |
| nagyobb, mint / kisebb, mint | Számok összehasonlítása. |
| tartalmazza | A szöveg tartalmazza a megadott részt; több választásnál az adott elem be van jelölve. |
| ezek egyike | Az érték a megadottak valamelyike. |
| üres / nem üres | A mező nincs, illetve ki van töltve. |

**Példa:** az „Indoklás” mező csak akkor látszódjon és legyen kötelező, ha az összeg 500 000 fölött van. Az Indoklás mezőnél a *Látható, ha* és a *Kötelező, ha* beállításhoz is vedd fel: `Összeg` – `nagyobb, mint` – `500000`.

### Az űrlap módja és a csoporttagság a feltételekben

A feltétel sorában a mezők listájának végén olyan elemek is választhatók, amelyek nem mezők. Mindegyik értéke **Igen** vagy **Nem**, ezért az `egyenlő` összehasonlítással és az Igen / Nem értékkel vizsgálhatók:

| Választható elem | Igen, ha |
| --- | --- |
| Űrlap módja: új elem | Az űrlap új elem felvételére nyílt meg. |
| Űrlap módja: szerkesztés | Az űrlap meglévő elem szerkesztésére nyílt meg. |
| Űrlap módja: megtekintés | Az űrlap megtekintésre nyílt meg. |
| A felhasználó az elem létrehozója | Az űrlapot megnyitó felhasználó hozta létre az elemet. Új elemnél mindig Igen. |
| Változó: *név* | A Változók fülön felvett változó értéke (lásd lent). |
| Csoporttag: *csoport neve* | Az űrlapot megnyitó felhasználó tagja a webhely adott SharePoint csoportjának. |

Ezeknek több feltétel összefűzésénél van igazán értelme. **Példa:** a „Jóváhagyó megjegyzése” mező szerkesztéskor csak a Jóváhagyók csoport tagjainak legyen írható. A mező *Csak olvasható, ha* beállításánál vedd fel, „Minden feltétel teljesül” mellett: `Űrlap módja: szerkesztés` – `egyenlő` – `Igen`, és `Csoporttag: Jóváhagyók` – `egyenlő` – `Nem`.

Tudnivalók a csoporttagságról:

- **Ez nem védelem.** A csoport alapján elrejtett vagy csak olvashatóvá tett mezőt a felhasználó más úton (például a lista rácsnézetében) ugyanúgy láthatja és módosíthatja. Érzékeny adatot a lista jogosultságaival védj.
- Az számít, hogy a felhasználó ténylegesen tagja-e a csoportnak; ez a webhely adminisztrátorára is igaz. A tervező előnézete is a te tagságod szerint mutatja az űrlapot.
- Az is tagnak számít, aki egy a SharePoint csoportba felvett címtárbeli (Entra vagy Microsoft 365) csoporton keresztül tag. Ha ezt az űrlap nem tudja ellenőrizni, az adminisztrátorok figyelmeztetést látnak az űrlap tetején; ilyenkor az így tag felhasználók nem tagnak számítanak.
- A csoport átnevezése után a feltétel tovább működik. Törölt csoportnál a feltétel úgy viselkedik, mintha senki nem lenne tagja.

### Változók

Ha ugyanazt a szabályt sok mezőnél vagy szekciónál használod, érdemes változóba tenni. A változót egyszer állítod össze, a feltételekben pedig a mezők listájának végén „Változó: *név*” néven választod ki. Ha a szabály később változik, csak a változót kell átírni.

A változókat az űrlap kijelölésénél megjelenő **Változók** fülön veszed fel a **Változó hozzáadása** gombbal. Kétféle változó van:

- **Feltétel (igen / nem):** a „Igen, ha” résznél ugyanúgy állítod össze, mint bármelyik feltételt (mezőérték, az űrlap módja, csoporttagság, sőt másik változó is lehet benne). A feltételekben Igen / Nem értékkel vizsgálod.
- **Mező értéke:** egy mező értéke, szükség esetén átalakítva. Bejelölheted, hogy **a mentett érték** számítson (amit az űrlap megnyitásakor a lista tartalmazott), ne az éppen beírt. Az átalakítások sorban hajtódnak végre: **szövegrész** (kezdet 0-tól számolva, és hossz), **számmá alakítás**, **szóközök levágása**, **kisbetűssé**, **nagybetűssé**.

**Példa:** a státusz első két karaktere számként, a mentett értékből: forrásmező Status, „A mentett érték” bejelölve, átalakítások: Szövegrész (kezdet 0, hossz 2), majd Számmá alakítás. Ebből egy „Feltétel” változó: `Űrlap módja: új elem` = Igen, VAGY `Változó: StatusNumber` = 1. A logisztikai mezőknél a *Látható, ha* feltétel ezután egyetlen sor: `Változó: HideLogistics` = Nem.

A változó neve betűvel kezdődik, és csak betűt, számot és aláhúzást tartalmazhat. Átnevezéskor a rá hivatkozó feltételek is követik. Ha egy változó (akár más változón keresztül) önmagára hivatkozik, a tervező figyelmeztet, és az értéke mindig Nem / üres.

### Feltétel beállítása több mezőre egyszerre

Az űrlap tulajdonságai között lévő **Feltétel több mezőre…** gombbal ugyanazt a feltételt egyszerre sok mezőre állíthatod be:

1. Válaszd ki a **beállítást**: Látható, ha / Csak olvasható, ha (gombnál: letiltva, ha) / Kötelező, ha.
2. Válaszd ki a **módját**: felülírja a mezők meglévő feltételét; hozzáfűzi ÉS kapcsolattal (mindkettő teljesüljön); hozzáfűzi VAGY kapcsolattal (bármelyik teljesüljön); vagy törli a meglévő feltételt.
3. Állítsd össze a **feltételt** (jellemzően egy változóra épülőt).
4. Jelöld ki a **mezőket**; a szekció nevére kattintva a szekció összes mezője kijelölődik.
5. Kattints az **Alkalmazás** gombra. A mezők többi beállítása nem változik, és amíg nem mented az elrendezést, minden visszavonható a Mégse gombbal.

A címke melletti **Szerkesztés JSON-ként** hivatkozással a feltétel szövegesen is szerkeszthető. Az egymásba ágyazott feltételcsoportok csak így szerkeszthetők; ezek maguktól szöveges formában jelennek meg.

## 8. Megjelenés (stílus)

A **Stílus** fülön a kijelölt elem megjelenése állítható: ha az űrlap van kijelölve, az űrlap egészéé, ha egy szakasz, a szakaszé, ha egy mező, a mezőé.

### Érvényesség

A fül tetején választod ki, mire vonatkozik, amit beállítasz:

- **Minden mód (alap):** mindhárom helyzetben érvényes.
- **Új elem / Szerkesztés / Megtekintés:** csak abban a helyzetben, és felülírja az alapot.

Amit egy módnál üresen hagysz, az az alapból öröklődik (halványan látszik is). Így például az alapban megadhatsz egy kiemelő színt, és csak a megtekintésnél adsz meg másik hátteret.

Ha egy mód stílusát szerkeszted, az előnézet módját is állítsd ugyanarra, különben nem látod a változást.

### Mit lehet beállítani

| Hol | Beállítás |
| --- | --- |
| Űrlap | Kiemelő szín (a cím és a szekciófejlécek színe), maximális szélesség, térköz (szellős / tömör), szekciófejléc típusa (aláhúzott / színes sáv / egyszerű) |
| Szekció | Fejléc színe |
| Mező | Címke színe |
| Felirat, gomb | Betűszín (a címke színe helyett); gombnál a háttér, a keret és a betűszín magára a gombra vonatkozik |
| Mindhárom | Háttér (egyszínű, lineáris vagy sugaras színátmenet), keretszín, keret vastagsága, lekerekítés |

A színeket a színválasztóval vagy kóddal (`#0078d4`) adhatod meg. Színátmenetnél kezdő és záró színt választasz, lineárisnál az irányt is.

Sötét vagy színátmenetes háttéren a szöveg színe nem igazodik magától: ügyelj az olvashatóságra (mezőnél a címke színével javítható).

## 9. Kapcsolódó elemek egy másik listából

Egy szekció felsorolhatja egy másik lista azon elemeit, amelyek a megnyitott elemhez tartoznak – például egy megrendelés alatt a hozzá tartozó számlákat. A felsorolás csak olvasható táblázat.

### Beállítás

Jelöld ki a szakaszt, és a tulajdonságai között jelöld be a **Kapcsolódó elemek megjelenítése egy másik listából** lehetőséget, majd add meg:

| Beállítás | Jelentés |
| --- | --- |
| Kapcsolódó lista | Melyik listából jöjjenek az elemek (ugyanazon a webhelyen). |
| Párosító mező a kapcsolódó listában | A másik lista mezője, amely alapján az elemek összetartoznak. |
| Ennek az elemnek ezzel a mezőjével egyezik | A megnyitott elem mezője (vagy az azonosítója), amellyel egyeznie kell. |
| Oszlopok | A táblázat oszlopai, a kiválasztás sorrendjében. |
| Rendezés, Csökkenő sorrend | A sorok sorrendje. |
| Sorok maximális száma | Alapból 30. |
| „Új elem” gomb megjelenítése | Megjelenjen-e gomb a másik lista új elem űrlapjának megnyitásához. |

**Példa:** a számlák listájában van egy „Megrendelésszám” mező, a megrendeléseknél a „Cím” tartalmazza ugyanezt a számot. A párosító mező a „Megrendelésszám”, a megnyitott elem mezője a „Cím”.

### Tudnivalók

- A táblázat első oszlopa a kapcsolódó elem megtekintő űrlapjára mutat, új lapon.
- **Új elem űrlapon a felsorolás nem látszik**, mert a párosítás az elem már mentett értékével történik.
- Az „Új elem” gomb nem tölti ki előre a párosító mezőt: az új elembe be kell írni az egyező értéket. A táblázat a **Frissítés** gombbal frissíthető.
- Mindenki csak azokat az elemeket látja, amelyekhez a másik listán joga van.

## 10. Tudnivalók és korlátok

- **Az űrlap nem védelem.** Ha egy mezőt elrejtesz vagy csak olvashatóvá teszel, az csak ezen az űrlapon érvényes. Akinek írási joga van a listán, az a rács nézetben (gyors szerkesztés) vagy más úton továbbra is módosíthatja. Ha egy adatot valóban védeni kell, azt jogosultsággal kell megoldani.
- **Rács nézetben és gyors szerkesztésnél** a SharePoint saját felülete jelenik meg, nem a FormJet.
- **Formázott szöveg:** szerkesztéskor csak az eszköztárban elérhető formázások maradnak meg. Ha egy meglévő szövegben betűszín, kiemelés vagy egyedi igazítás van, és beleírsz a mezőbe, ezek mentéskor eltűnnek. Amíg nem nyúlsz a mezőhöz, semmi nem változik.
- **Rejtett mező értéke nem változik.** Az űrlap csak azt menti, ami látszik, szerkeszthető és megváltozott; a rejtett mező korábbi értéke megmarad.
- **Nagy listák:** keresőmezőnél legfeljebb 2000 elem, felügyelt metaadatnál legfeljebb 2000 kifejezés választható; efelett a mező alatt figyelmeztetés jelenik meg.
- **Kép törlése** csak a mező értékét üríti, a korábban feltöltött fájl a webhely eszköztárában marad.
- **Számított oszlopok és rendszermezők** (létrehozva, módosítva, létrehozta, módosította) nem szerkeszthetők; a számított megjelenítő oszlopok fel sem vehetők az űrlapra.
- **Hely mező:** a kereső külső szolgáltatásra támaszkodik. Ha nem érhető el, a mező alatt üzenet jelenik meg, és a beírt szöveg helyként továbbra is használható.

## 11. Gyakori kérdések

**Nem látom a Tervező kapcsolót.**
Csak a webhely adminisztrátorai látják. Ha annak kellene lenned, kérj megfelelő jogosultságot a webhely tulajdonosától.

**Egy mező nem jelenik meg az űrlapon.**
Vagy nincs egyetlen szekcióban sem (a tervezőben a nem elhelyezett mezők között találod), vagy az adott helyzetben rejtett, vagy egy feltétel miatt nem látszik. Tervező módban a rejtett mezők halványan megjelennek.

**Az adminisztrátor figyelmeztetést lát: „A mentett konfiguráció hibás, az alapértelmezett elrendezés látható.”**
A tárolt elrendezés megsérült vagy kézzel hibásan módosították. Az űrlap ilyenkor is használható, az összes mezővel egy szekcióban. A tervezőben újra összeállítható és menthető.

**„A konfiguráció nem létező mezőkre hivatkozik…”**
Az elrendezésben olyan oszlop szerepel, amelyet azóta töröltek vagy átneveztek a listában. Vedd ki a szekcióból, és mentsd az elrendezést.

**„A konfigurációt időközben más admin módosította.”**
Ketten szerkesztettétek egyszerre az elrendezést. Töltsd újra az oldalt, és végezd el újra a módosításaidat.

**Mentéskor dátumhibát kapok.**
A dátumot a webhely területi beállítása szerinti formában kell megadni. A naptárból választva mindig jó formátum kerül a mezőbe.

**A melléklet mező nem jelenik meg.**
A listán engedélyezni kell a mellékleteket, és a mezőt el kell helyezni egy szekcióban.

**Az űrlap helyett a SharePoint eredeti űrlapja nyílik meg.**
A FormJet nincs bekapcsolva ezen a listán. A webhely tulajdonosa a **FormJet beállítása** webparton tudja bekapcsolni (lásd [A FormJet bekapcsolása egy listán](#a-formjet-bekapcsolása-egy-listán)).
