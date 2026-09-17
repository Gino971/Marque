import { useMemo, useState } from 'react';

type RowState = {
  takerIndex: number | null;
  takerScore: string;
  editingPlayerIndex: number | null;
  draftScore: string;
};

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;
const MIN_GAMES = 3;
const MAX_GAMES = 10;
const DEFAULT_PLAYER_NAMES = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6'];
const PLAYER_SETUP_OPTIONS = ['3x3', '3x2', '4', '5', '6'] as const;
type PlayerSetup = (typeof PLAYER_SETUP_OPTIONS)[number];

function getPlayerSetupConfig(playerSetup: PlayerSetup) {
  if (playerSetup === '3x3') {
    return { playerCount: 3, divider: 3 };
  }

  if (playerSetup === '3x2') {
    return { playerCount: 3, divider: 2 };
  }

  return { playerCount: Number(playerSetup), divider: 3 };
}

function createEmptyRow(): RowState {
  return {
    takerIndex: null,
    takerScore: '',
    editingPlayerIndex: null,
    draftScore: ''
  };
}

function parseScore(rawValue: string) {
  if (rawValue.trim() === '') {
    return null;
  }

  const score = Number(rawValue);
  return Number.isInteger(score) ? score : null;
}

function formatScore(value: number) {
  return `${value}`;
}

function getGrayPlayers(rowIndex: number, playerCount: number) {
  if (playerCount === 5) {
    return [rowIndex % playerCount];
  }

  if (playerCount === 6) {
    return [rowIndex % playerCount, (rowIndex + 1) % playerCount];
  }

  return [];
}

function isGrayPlayer(rowIndex: number, playerCount: number, playerIndex: number) {
  return getGrayPlayers(rowIndex, playerCount).includes(playerIndex);
}

function getFirstEditableCell(playerSetup: PlayerSetup) {
  const { playerCount } = getPlayerSetupConfig(playerSetup);

  for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
    if (!isGrayPlayer(0, playerCount, playerIndex)) {
      return { rowIndex: 0, playerIndex };
    }
  }

  return { rowIndex: 0, playerIndex: 0 };
}

export default function App() {
  const [playerSetup, setPlayerSetup] = useState<PlayerSetup>('4');
  const [gameCount, setGameCount] = useState(6);
  const [playerNames, setPlayerNames] = useState(DEFAULT_PLAYER_NAMES);
  const [rows, setRows] = useState<RowState[]>(() => Array.from({ length: MAX_GAMES }, () => createEmptyRow()));
  const [pendingPlayerSetup, setPendingPlayerSetup] = useState<PlayerSetup | null>(null);
  const [pendingReset, setPendingReset] = useState(false);
  const [activeCell, setActiveCell] = useState<{ rowIndex: number; playerIndex: number } | null>(null);
  const [keypadError, setKeypadError] = useState<string | null>(null);

  const { playerCount, divider } = getPlayerSetupConfig(playerSetup);
  const visiblePlayers = useMemo(() => Array.from({ length: playerCount }, (_, index) => index), [playerCount]);
  const visibleRows = rows.slice(0, gameCount);

  const updateRow = (rowIndex: number, updater: (row: RowState) => RowState) => {
    setRows((currentRows) => currentRows.map((row, index) => (index === rowIndex ? updater(row) : row)));
  };

  const MAX_SCORE_LENGTH = 5;

  const startEditingCell = (rowIndex: number, playerIndex: number) => {
    updateRow(rowIndex, (row) => ({
      ...row,
      editingPlayerIndex: playerIndex,
      takerIndex: playerIndex,
      draftScore: row.takerIndex === playerIndex ? row.takerScore : ''
    }));
  };

  // Valide et enregistre la cellule actuellement en cours d'édition.
  // Si le score n'est pas valide (pas un multiple du diviseur), on affiche une
  // erreur sous le clavier perso et on laisse la cellule ouverte pour correction.
  const commitActiveCell = () => {
    if (!activeCell) {
      return;
    }

    const { rowIndex, playerIndex } = activeCell;
    const row = rows[rowIndex];
    const rawValue = row.draftScore;
    const score = parseScore(rawValue);
    const isEmptyOrDash = rawValue.trim() === '' || rawValue === '-';

    if (isEmptyOrDash || score === 0) {
      updateRow(rowIndex, () => ({
        takerIndex: isEmptyOrDash ? null : playerIndex,
        takerScore: isEmptyOrDash ? '' : '0',
        editingPlayerIndex: null,
        draftScore: ''
      }));
      setKeypadError(null);
      setActiveCell(null);
      return;
    }

    if (score === null || score % divider !== 0) {
      setKeypadError(`Le score doit être un multiple de ${divider}.`);
      return;
    }

    updateRow(rowIndex, () => ({
      takerIndex: playerIndex,
      takerScore: rawValue,
      editingPlayerIndex: null,
      draftScore: ''
    }));
    setKeypadError(null);
    setActiveCell(null);
  };

  // Comme commitActiveCell, mais utilisé quand on change de cellule : une saisie
  // invalide (pas multiple du diviseur) est abandonnée silencieusement plutôt que
  // de bloquer la navigation vers une autre cellule.
  const resolveActiveCellForSwitch = () => {
    if (!activeCell) {
      return;
    }

    const { rowIndex, playerIndex } = activeCell;
    const rawValue = rows[rowIndex].draftScore;
    const score = parseScore(rawValue);
    const isEmptyOrDash = rawValue.trim() === '' || rawValue === '-';

    if (isEmptyOrDash || score === 0 || (score !== null && score % divider === 0)) {
      updateRow(rowIndex, () => ({
        takerIndex: isEmptyOrDash ? null : playerIndex,
        takerScore: isEmptyOrDash ? '' : rawValue,
        editingPlayerIndex: null,
        draftScore: ''
      }));
      return;
    }

    updateRow(rowIndex, (row) => ({ ...row, editingPlayerIndex: null, draftScore: '' }));
  };

  // Active une cellule : résout la précédente si besoin, puis ouvre le clavier perso sur la nouvelle.
  const activateCell = (rowIndex: number, playerIndex: number) => {
    if (isGrayPlayer(rowIndex, playerCount, playerIndex)) {
      return;
    }

    if (activeCell && (activeCell.rowIndex !== rowIndex || activeCell.playerIndex !== playerIndex)) {
      resolveActiveCellForSwitch();
    }

    setKeypadError(null);
    startEditingCell(rowIndex, playerIndex);
    setActiveCell({ rowIndex, playerIndex });
  };

  const closeKeypad = () => {
    commitActiveCell();
  };

  const appendDigit = (digit: string) => {
    if (!activeCell) {
      return;
    }

    const { rowIndex, playerIndex } = activeCell;
    setKeypadError(null);
    updateRow(rowIndex, (row) => {
      if (row.editingPlayerIndex !== playerIndex || row.draftScore.replace('-', '').length >= MAX_SCORE_LENGTH) {
        return row;
      }

      return { ...row, draftScore: row.draftScore + digit };
    });
  };

  const toggleSign = () => {
    if (!activeCell) {
      return;
    }

    const { rowIndex, playerIndex } = activeCell;
    setKeypadError(null);
    updateRow(rowIndex, (row) => {
      if (row.editingPlayerIndex !== playerIndex) {
        return row;
      }

      const nextValue = row.draftScore.startsWith('-') ? row.draftScore.slice(1) : `-${row.draftScore}`;
      return { ...row, draftScore: nextValue };
    });
  };

  const backspaceDigit = () => {
    if (!activeCell) {
      return;
    }

    const { rowIndex, playerIndex } = activeCell;
    setKeypadError(null);
    updateRow(rowIndex, (row) => {
      if (row.editingPlayerIndex !== playerIndex) {
        return row;
      }

      return { ...row, draftScore: row.draftScore.slice(0, -1) };
    });
  };

  const applyPlayerSetup = (nextPlayerSetup: PlayerSetup, keepScores: boolean) => {
    const { playerCount: nextPlayerCount } = getPlayerSetupConfig(nextPlayerSetup);

    setPendingPlayerSetup(null);

    if (!keepScores) {
      resetBoard(nextPlayerSetup, true);
      return;
    }

    setPlayerSetup(nextPlayerSetup);

    setPlayerNames((currentNames) => currentNames.map((name, index) => (index < nextPlayerCount ? name : DEFAULT_PLAYER_NAMES[index])));
    setRows((currentRows) =>
      currentRows.map((row, rowIndex) => {
        const grayPlayers = getGrayPlayers(rowIndex, nextPlayerCount);

        if (row.takerIndex === null || (row.takerIndex < nextPlayerCount && !grayPlayers.includes(row.takerIndex))) {
          return row;
        }

        return {
          takerIndex: null,
          takerScore: '',
          editingPlayerIndex: null,
          draftScore: ''
        };
      })
    );
  };

  const openPlayerSetupDialog = (nextPlayerSetup: PlayerSetup) => {
    if (nextPlayerSetup === playerSetup) {
      return;
    }

    setPendingPlayerSetup(nextPlayerSetup);
  };

  const resetBoard = (targetPlayerSetup: PlayerSetup, skipConfirm = false) => {
    const shouldClear = skipConfirm;

    if (!shouldClear) {
      return;
    }

    setPendingReset(false);
    setPlayerSetup(targetPlayerSetup);
    setGameCount(6);
    setPlayerNames(DEFAULT_PLAYER_NAMES);
    setRows(Array.from({ length: MAX_GAMES }, () => createEmptyRow()));
    setKeypadError(null);

    const firstEditableCell = getFirstEditableCell(targetPlayerSetup);
    setActiveCell(firstEditableCell);
    updateRow(firstEditableCell.rowIndex, (row) => ({
      ...row,
      editingPlayerIndex: firstEditableCell.playerIndex,
      takerIndex: firstEditableCell.playerIndex,
      draftScore: ''
    }));
  };

  const clearAll = () => {
    setPendingReset(true);
  };

  const totals = useMemo(() => {
    return visiblePlayers.map((playerIndex) => {
      let total = 0;

      visibleRows.forEach((row, rowIndex) => {
        const grayPlayers = getGrayPlayers(rowIndex, playerCount);

        if (grayPlayers.includes(playerIndex)) {
          return;
        }

        if (row.takerIndex === null) {
          return;
        }

        const score = parseScore(row.takerScore);
        if (score === null || score % divider !== 0) {
          return;
        }

        const share = score / divider;

        if (playerIndex === row.takerIndex) {
          total += score;
        } else {
          total -= share;
        }
      });

      return total;
    });
  }, [divider, playerCount, visiblePlayers, visibleRows]);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <h1>Feuille de marque autonome</h1>

        <div className="controls">
          <label>
            <span>Joueurs</span>
            <select value={playerSetup} onChange={(event) => openPlayerSetupDialog(event.target.value as PlayerSetup)}>
              {PLAYER_SETUP_OPTIONS.map((setup) => {
                if (setup === '3x3') {
                  return (
                    <option key={setup} value={setup}>
                      3 (X3)
                    </option>
                  );
                }

                if (setup === '3x2') {
                  return (
                    <option key={setup} value={setup}>
                      3 (X2)
                    </option>
                  );
                }

                return (
                  <option key={setup} value={setup}>
                    {setup} joueurs
                  </option>
                );
              })}
            </select>
          </label>

          <label>
            <span>Parties</span>
            <select value={gameCount} onChange={(event) => setGameCount(Number(event.target.value))}>
              {Array.from({ length: MAX_GAMES - MIN_GAMES + 1 }, (_, index) => MIN_GAMES + index).map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>

          <button className="reset-button" type="button" onClick={clearAll} aria-label="Tout effacer">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3 6h18" />
              <path d="M8 6V4.75A1.75 1.75 0 0 1 9.75 3h4.5A1.75 1.75 0 0 1 16 4.75V6" />
              <path d="M6.5 6.5l.85 11.15A2 2 0 0 0 9.34 19.5h5.32a2 2 0 0 0 1.99-1.85l.85-11.15" />
              <path d="M10 10v5M14 10v5" />
            </svg>
          </button>
        </div>
      </section>

      {pendingPlayerSetup ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setPendingPlayerSetup(null)}>
          <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="player-setup-dialog-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="player-setup-dialog-title">Changer le nombre de joueurs ?</h2>
            <p>Que veux-tu faire avec les scores en cours ?</p>

            <div className="dialog-actions">
              <button type="button" className="dialog-secondary" onClick={() => setPendingPlayerSetup(null)}>
                Annuler
              </button>
              <button type="button" className="dialog-primary" onClick={() => applyPlayerSetup(pendingPlayerSetup, true)}>
                Conserver les scores
              </button>
              <button type="button" className="dialog-danger" onClick={() => applyPlayerSetup(pendingPlayerSetup, false)}>
                Tout effacer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingReset ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setPendingReset(false)}>
          <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="reset-dialog-title">Tout effacer ?</h2>
            <p>Cette action supprimera les scores et les noms saisis.</p>

            <div className="dialog-actions">
              <button type="button" className="dialog-secondary" onClick={() => setPendingReset(false)}>
                Annuler
              </button>
              <button type="button" className="dialog-danger" onClick={() => {
                setPendingReset(false);
                resetBoard('4', true);
              }}>
                Tout effacer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="sticky-left part-header">N°</th>
                {visiblePlayers.map((playerIndex) => (
                  <th key={`header-${playerIndex}`}>
                    <input
                      aria-label={`Nom du joueur ${playerIndex + 1}`}
                      value={playerNames[playerIndex]}
                      placeholder={`J${playerIndex + 1}`}
                      onChange={(event) =>
                        setPlayerNames((currentNames) =>
                          currentNames.map((name, index) => (index === playerIndex ? event.target.value : name))
                        )
                      }
                    />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row, rowIndex) => {
                const score = parseScore(row.takerScore);
                const grayPlayers = getGrayPlayers(rowIndex, playerCount);
                const canCalculate = row.takerIndex !== null && score !== null && score % divider === 0;
                const share = canCalculate ? score / divider : null;

                return (
                  <tr key={rowIndex}>
                    <td className="sticky-left part-number">{rowIndex + 1}</td>

                    {visiblePlayers.map((playerIndex) => {
                      const isEditing = row.editingPlayerIndex === playerIndex;
                      const isTaker = row.takerIndex === playerIndex;
                      const isGray = grayPlayers.includes(playerIndex);
                      const rawScoreValue = isEditing
                        ? row.draftScore
                        : isTaker
                          ? row.takerScore
                          : row.takerIndex === null
                            ? ''
                            : canCalculate && share !== null
                              ? formatScore(-share)
                              : '';
                      const isNegativeScore = rawScoreValue.trim().startsWith('-');
                      const isActiveCell = activeCell?.rowIndex === rowIndex && activeCell?.playerIndex === playerIndex;

                      return (
                        <td key={`${rowIndex}-${playerIndex}`} className={isGray ? 'gray' : canCalculate ? (isTaker ? 'taker' : 'defender') : 'ghost'}>
                          <div
                            className={isActiveCell ? 'score-field score-field--active' : 'score-field'}
                            onClick={isGray ? undefined : () => activateCell(rowIndex, playerIndex)}
                          >
                            <input
                              aria-label={`Score de J${playerIndex + 1} pour la partie ${rowIndex + 1}`}
                              type="text"
                              inputMode="none"
                              tabIndex={-1}
                              readOnly
                              onMouseDown={(event) => event.preventDefault()}
                              value={isGray ? '' : rawScoreValue}
                              className={isNegativeScore ? 'score-negative' : undefined}
                              placeholder={isGray ? '' : '0'}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr>
                <th className="sticky-left">Total</th>
                {totals.map((total, playerIndex) => (
                  <th key={`total-${playerIndex}`}>{formatScore(total)}</th>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {activeCell ? (
        <div className="keypad-backdrop" role="presentation" onClick={closeKeypad}>
          <div className="keypad" role="group" aria-label="Clavier numérique" onClick={(event) => event.stopPropagation()}>
            {keypadError ? <p className="keypad-error">{keypadError}</p> : null}

            <div className="keypad-grid">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button key={digit} type="button" onClick={() => appendDigit(digit)}>
                  {digit}
                </button>
              ))}
              <button type="button" aria-label="Signe moins" onClick={toggleSign}>
                −
              </button>
              <button type="button" onClick={() => appendDigit('0')}>
                0
              </button>
              <button type="button" aria-label="Effacer le dernier chiffre" onClick={backspaceDigit}>
                ⌫
              </button>
            </div>

            <button type="button" className="keypad-confirm" onClick={closeKeypad}>
              OK
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}