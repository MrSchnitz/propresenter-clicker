# Průvodce pro řečníka a admina

## Pro řečníka

Otevři v telefonu nebo tabletu adresu **presenter.cbjasenka.xyz** — nebo adresu, kterou ti dal technik (například `http://192.168.1.50:7777`).

Na obrazovce uvidíš náhledy slidů aktuální prezentace.

- Klepni na **šipku doprava** (nebo na pravou část obrazovky) pro přechod na **další slide**.
- Klepni na **šipku doleva** (nebo na levou část obrazovky) pro **předchozí slide**.

To je vše — ProPresenter se přepne automaticky.

---

## Pro admina

1. Zapni ProPresenter
2. Zkontroluj, že běží Docker se spuštěným **propresenter-clicker** conteinerem. (volitelné, měl by se spustit po přihlášení)
3. Otevři v prohlížeči adresu **presenter.cbjasenka.xyz/admin** — nebo adresu od technika s `/admin` na konci (například `http://192.168.1.50:7777/admin`).

### Přihlášení

Zadej PIN, který ti dal technik, a klepni na **Přihlásit**.

### Nastavení PINu pro řečníka

Nastav libovolný nejlépe číselný PIN pro řečníka na začátku admin rozhraní, kvůli bezpečnosti. 

### Výběr prezentace

Po přihlášení uvidíš seznam prezentací načtených z ProPresenteru.

1. Klepni na prezentaci, kterou chceš použít.
2. Potvrď výběr — prezentace se zamkne a řečník ji uvidí na svém telefonu.

### Odhlášení

Přihlášení platí 24 hodin. Pro ruční odhlášení klepni na tlačítko **Odhlásit** v horní části stránky.

---

## Nejčastější dotazy

**Aplikace nefunguje** - Zkontroluj, že běží Docker a container **propresenter-clicker**. `Docker --> Containers --> propresenter-clicker --> tlačítko Play`

**Nevidím žádné slidy.** — Technik musí nejprve vybrat prezentaci v adminu.

**Tlačítka nereagují.** — Ujisti se, že jsi připojen/a na stejnou Wi-Fi síť jako zbytek sestavy. Stránku obnov (zatáhni dolů nebo zmáčkni F5).

**Přihlášení do adminu nefunguje.** — Zkontroluj PIN s technikem (ideálně se podívat na hodnotu `ADMIN_PIN` v .env souboru ve složce aplikace). Přihlášení vyprší po 24 hodinách.
