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

Egy érték esetén legördülő listából választasz. Több érték esetén a listában több elemet is bejelölhetsz.

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
- **Jobbra a tervező panel** négy füllel: Elrendezés, Mező, Stílus, JSON.

Az előnézet fölötti **Előnézet módja** választóval megnézheted, hogyan fest az űrlap új elemnél, szerkesztéskor és megtekintéskor. Az előnézet mezőibe írhatsz is, így a feltételek hatását azonnal kipróbálhatod.

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

A webpart **Konfigurációs lista** része azt a listát mutatja, amelyben az elrendezések tárolódnak. Ha még nincs meg, a **Lista létrehozása** gombbal létrehozható (az első elrendezés mentésekor magától is létrejön). A **Csak olvasás a tagoknak** gombbal beállítható, hogy az elrendezéseket csak a tulajdonosok módosíthassák; ezt érdemes megtenni.

## 5. Elrendezés: szekciók és mezők

### Áthelyezés húzással

Tervező módban minden szekció és mező jobb felső sarkában megjelenik egy kis fogantyú (pöttyös ikon). Ennél fogva:

- a **mezők** szekción belül átrendezhetők, és másik szekcióba is áthúzhatók;
- a **szekciók** egymáshoz képest átrendezhetők.

Az üres szekció „Húzz ide egy mezőt” feliratú területként látszik. Billentyűzettel is működik: a fogantyún szóköz, nyilak, majd újra szóköz; az Esc megszakítja.

### Új mező felvétele

Az **Elrendezés** fül tetején, a **Nem elhelyezett mezők** alatt azok a mezők láthatók, amelyek még nem szerepelnek az űrlapon. Kétféleképp veheted fel őket:

- húzd a mező címkéjét az előnézet egy szekciójára (egy mezőre ejtve elé kerül, a szekció üres részére ejtve a végére);
- vagy a szekció kártyáján a **Mező hozzáadása…** listából válaszd ki.

Ami nincs egyetlen szekcióban sem, az nem jelenik meg az űrlapon. A **mellékletek** is így vehetők fel: a mentett elrendezésekben a nem elhelyezett mezők között találod.

### A szekció beállításai

Az Elrendezés fülön minden szekciónak van egy kártyája; a fejlécére kattintva nyílik ki (egyszerre egy van nyitva).

| Beállítás | Jelentés |
| --- | --- |
| Cím, Leírás | A szekció fejléce és az alatta megjelenő rövid szöveg. |
| Oszlopok száma | 1–4. Ennyi mező fér egymás mellé; keskeny képernyőn a mezők egymás alá kerülnek. |
| Becsukható, Alapból csukva | A felhasználó becsukhatja-e a szekciót, és csukva nyíljon-e meg. |
| Látható ezekben a módokban | Új elem / Szerkesztés / Megtekintés. |
| Látható, ha | Feltétel, amely mellett a szekció megjelenik (lásd [Feltételek](#7-feltételek)). |
| Kapcsolódó elemek… | Egy másik lista elemeinek felsorolása (lásd [9. fejezet](#9-kapcsolódó-elemek-egy-másik-listából)). |

A kártya fejlécében lévő nyilakkal a szekció mozgatható, a kuka ikonnal törölhető. Törléskor a mezői nem vesznek el, hanem a nem elhelyezett mezők közé kerülnek.

A szekció mezőinek listájában mezőnként beállítható a **szélesség** (hány oszlopot foglaljon el), és a mező eltávolítható a szekcióból. A mező nevére kattintva a Mező fülre jutsz.

A **Új szekció** gomb a lista végére vesz fel egy szekciót.

## 6. Egy mező beállításai

A **Mező** fülön válassz mezőt a listából, vagy kattints rá az előnézetben.

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

| Összehasonlítás | Mikor teljesül |
| --- | --- |
| egyenlő / nem egyenlő | Az érték megegyezik, illetve eltér. A kis- és nagybetű nem számít. |
| nagyobb, mint / kisebb, mint | Számok összehasonlítása. |
| tartalmazza | A szöveg tartalmazza a megadott részt; több választásnál az adott elem be van jelölve. |
| ezek egyike | Az érték a megadottak valamelyike. |
| üres / nem üres | A mező nincs, illetve ki van töltve. |

**Példa:** az „Indoklás” mező csak akkor látszódjon és legyen kötelező, ha az összeg 500 000 fölött van. Az Indoklás mezőnél a *Látható, ha* és a *Kötelező, ha* beállításhoz is vedd fel: `Összeg` – `nagyobb, mint` – `500000`.

A címke melletti **Szerkesztés JSON-ként** hivatkozással a feltétel szövegesen is szerkeszthető. Az egymásba ágyazott feltételcsoportok csak így szerkeszthetők; ezek maguktól szöveges formában jelennek meg.

## 8. Megjelenés (stílus)

A **Stílus** fülön az űrlap egészének, egy szekciónak és egy mezőnek a megjelenése állítható.

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
| Mindhárom | Háttér (egyszínű, lineáris vagy sugaras színátmenet), keretszín, keret vastagsága, lekerekítés |

A színeket a színválasztóval vagy kóddal (`#0078d4`) adhatod meg. Színátmenetnél kezdő és záró színt választasz, lineárisnál az irányt is.

Sötét vagy színátmenetes háttéren a szöveg színe nem igazodik magától: ügyelj az olvashatóságra (mezőnél a címke színével javítható).

## 9. Kapcsolódó elemek egy másik listából

Egy szekció felsorolhatja egy másik lista azon elemeit, amelyek a megnyitott elemhez tartoznak – például egy megrendelés alatt a hozzá tartozó számlákat. A felsorolás csak olvasható táblázat.

### Beállítás

A szekció kártyáján jelöld be a **Kapcsolódó elemek megjelenítése egy másik listából** lehetőséget, majd add meg:

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
