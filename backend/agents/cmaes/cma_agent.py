import logging
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)


class CMAAgent:
    """
    CMA-ES–like agent with:
      - normalized space [0, 1]^d
      - mean vector m
      - global step-size sigma
      - full covariance matrix C
      - evolution paths p_sigma (ps) and p_c (pc)

    API:
      - play()   : sample a new parameter dict from N(m, sigma^2 * C)
      - update() : update internal state from evaluated samples
    """

    def __init__(
        self,
        parameters_def: Dict[str, Dict[str, Any]],
        sigma0: float = 0.3,
        population_size: int = 10,
    ) -> None:
        """
        parameters_def: dict { name: { "type": "float"/"integer"/"choice", "range": [min, max], ... } }
        sigma0        : initial global step-size in normalized space
        population_size: used as λ (nominal population size)
        """
        self.parameters_def = parameters_def
        self.population_size = population_size

        self._names = []
        self._types = []
        self._mins = []
        self._maxs = []
        self._choices = []  # parallel list: None or list of choices

        # Exploration adjustment parameters for time_warp
        self.factor_per_step = 1.2  # multiplicative factor per time step
        self.sigma_min = 1e-3  # minimum sigma
        self.sigma_max = 1.0  # maximum sigma

        for name, p in parameters_def.items():
            ptype = p.get("type", "float")

            if ptype == "choice":
                choices = p["choices"]
                lo, hi = 0.0, float(len(choices) - 1)
                self._names.append(name)
                self._types.append("choice")
                self._mins.append(lo)
                self._maxs.append(hi)
                self._choices.append(choices)

            else:
                lo, hi = p["range"]
                self._names.append(name)
                self._types.append(ptype)
                self._mins.append(float(lo))
                self._maxs.append(float(hi))
                self._choices.append(None)

        self._mins = np.array(self._mins, dtype=float)
        self._maxs = np.array(self._maxs, dtype=float)
        self.dim = len(self._names)

        # normalized mean and global sigma
        self.mean = np.full(self.dim, 0.5, dtype=float)  # start at center
        self.sigma = float(sigma0)

        # CMA-ES core state: covariance + evolution paths
        self.C = np.eye(self.dim, dtype=float)  # covariance in normalized space
        self.pc = np.zeros(self.dim, dtype=float)  # evolution path for covariance
        self.ps = np.zeros(self.dim, dtype=float)  # evolution path for sigma

        self.generation = 0  # number of update() calls that actually did an update

        # Strategy parameters (standard CMA-ES formulas, adapted)
        self._init_strategy_params()

        # For CSA (expected length of N(0, I))
        self.chiN = np.sqrt(self.dim) * (
            1.0 - 1.0 / (4.0 * self.dim) + 1.0 / (21.0 * self.dim**2)
        )

        # Archive of evaluated points: list of (params_dict, score)
        self.list_of_points = []

    # ------------------------------------------------------------------
    # Strategy parameter initialization
    # ------------------------------------------------------------------
    def _init_strategy_params(self) -> None:
        dim = self.dim
        if self.population_size is not None:
            _lambda = self.population_size
        else:
            _lambda = 4 + int(3 * np.log(dim)) # theoretical formula

        _lambda = max(_lambda, 4)
        self._lambda = _lambda

        # µ = number of selected (elite) individuals
        self.mu = _lambda // 2
        # log weights for recombination
        weights = np.log(self.mu + 0.5) - np.log(np.arange(1, self.mu + 1))
        self.weights = weights / np.sum(weights)
        self.mu_eff = 1.0 / np.sum(self.weights**2)  # effective µ

        # Step-size control parameters (CSA)
        self.cs = (self.mu_eff + 2) / (dim + self.mu_eff + 5)
        self.ds = 1 + 2 * max(0, np.sqrt((self.mu_eff - 1) / (dim + 1)) - 1) + self.cs

        # Covariance matrix adaptation parameters
        self.cc = (4 + self.mu_eff / dim) / (dim + 4 + 2 * self.mu_eff / dim)
        self.c1 = 2 / ((dim + 1.3) ** 2 + self.mu_eff)
        alpha_mu = 2
        self.cmu = min(
            1 - self.c1,
            alpha_mu
            * (self.mu_eff - 2 + 1 / self.mu_eff)
            / ((dim + 2) ** 2 + alpha_mu * self.mu_eff),
        )

    # ------------------------------------------------------------------
    # Helpers: encode/decode between dict and normalized vector
    # ------------------------------------------------------------------
    def _encode(self, params_dict: Dict[str, Any]) -> np.ndarray:
        x = np.zeros(self.dim, dtype=float)
        for i, name in enumerate(self._names):
            pdef = self.parameters_def[name]
            ptype = pdef.get("type", "float")
            lo = self._mins[i]
            hi = self._maxs[i]

            if ptype in ("float", "integer"):
                val = params_dict.get(name, lo)
            elif ptype == "choice":
                choices = self._choices[i]
                default = choices[0]
                val_raw = params_dict.get(name, default)
                try:
                    idx = choices.index(val_raw)
                except ValueError:
                    idx = 0
                val = idx  # numeric code 0..N-1
            else:
                val = lo

            if hi == lo:
                x[i] = 0.0
            else:
                x[i] = (float(val) - lo) / (hi - lo)

        return np.clip(x, 0.0, 1.0)

    def _decode(self, x_norm: np.ndarray) -> Dict[str, Any]:
        """
        Convert a normalized vector x in [0,1]^d back to a params dict
        respecting types (float/int/choice) and min/max.
        """
        params = {}
        x_norm = np.asarray(x_norm, dtype=float)
        for i, name in enumerate(self._names):
            pdef = self.parameters_def[name]
            ptype = pdef.get("type", "float")
            lo = self._mins[i]
            hi = self._maxs[i]

            if ptype == "choice":
                choices = self._choices[i]
                n = len(choices)
                if n == 1:
                    params[name] = choices[0]
                else:
                    idx_float = x_norm[i] * (n - 1)
                    idx = int(round(idx_float))
                    idx = int(np.clip(idx, 0, n - 1))
                    params[name] = choices[idx]
            elif ptype in ("float", "integer"):
                val = lo + x_norm[i] * (hi - lo)
                if ptype == "integer":
                    params[name] = int(round(val))
                else:
                    params[name] = float(val)
            else:
                logger.warning(
                    f"Unsupported parameter type '{ptype}' for parameter '{name}'. Skipping."
                )

        return params

    # ------------------------------------------------------------------
    # API
    # ------------------------------------------------------------------
    def play(self) -> Dict[str, Any]:
        """
        Sample one new parameter dict from the current Gaussian
        N(mean, sigma^2 * C) in normalized space, and return it.
        """
        # Cholesky decomposition of C
        try:
            A = np.linalg.cholesky(self.C)
        except np.linalg.LinAlgError:
            # fallback to eigen-decomposition
            eigvals, eigvecs = np.linalg.eigh(self.C)
            eigvals = np.maximum(eigvals, 1e-12)
            A = eigvecs @ np.diag(np.sqrt(eigvals)) @ eigvecs.T

        z = np.random.randn(self.dim)
        y = A @ z
        x_norm = self.mean + self.sigma * y
        x_norm = np.clip(x_norm, 0.0, 1.0)
        return self._decode(x_norm)

    def update(
        self,
        params: Dict[str, Any],
        score: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """
        Update the internal mean, C, and sigma from evaluated samples.

        Each call appends (params, score) to an internal archive.
        Once the archive has enough points, we perform a CMA-ES update.
        """
        self.list_of_points.append((params, score))

        if len(self.list_of_points) < 4:
            return

        # Use at most the last self._lambda points from archive
        all_points = self.list_of_points[-self._lambda :]
        xs = []
        scores = []
        for p, s in all_points:
            xs.append(self._encode(p))
            scores.append(float(s))

        xs = np.vstack(xs)         # shape (n, dim)
        scores = np.asarray(scores)  # shape (n,)

        # Sort by score (best first)
        idx = np.argsort(-scores)  # descending
        xs = xs[idx]
        scores = scores[idx]

        # Number of offspring actually used this "generation"
        lam_eff = xs.shape[0]
        if lam_eff < 4:
            return

        # Number of elites can't exceed available points
        mu_eff = min(self.mu, lam_eff)
        weights = self.weights[:mu_eff]
        weights = weights / np.sum(weights)  # re-normalize if mu_eff < self.mu

        # Old mean (m_t)
        m_old = self.mean.copy()
        sigma_old = self.sigma

        # New mean m_{t+1} as weighted recombination of elites
        elite = xs[:mu_eff]
        mean_new = np.sum(elite * weights[:, None], axis=0)

        # Mean step in normalized space
        y_mean = (mean_new - m_old) / sigma_old  # "normalized" mean step

        # Update evolution path for sigma: ps
        eigvals, eigvecs = np.linalg.eigh(self.C)
        eigvals = np.maximum(eigvals, 1e-12)
        C_inv_sqrt = eigvecs @ np.diag(1.0 / np.sqrt(eigvals)) @ eigvecs.T

        # recompute mu_eff for this generation
        mu_eff_here = 1.0 / np.sum(weights**2)

        self.ps = (1 - self.cs) * self.ps + np.sqrt(
            self.cs * (2 - self.cs) * self.mu_eff
        ) * (C_inv_sqrt @ y_mean)

        # Step-size control (CSA)
        ps_norm = float(np.linalg.norm(self.ps))
        sigma_new = sigma_old * np.exp(
            (self.cs / self.ds) * (ps_norm / self.chiN - 1.0)
        )

        # h_sigma: indicator for successful evolution path
        self.generation += 1
        h_sigma_cond = ps_norm / np.sqrt(1 - (1 - self.cs) ** (2 * self.generation))
        h_sigma = 1.0 if h_sigma_cond < (1.4 + 2 / (self.dim + 1)) * self.chiN else 0.0

        # Update evolution path for covariance: pc (still using y_mean with sigma_old)
        self.pc = (1 - self.cc) * self.pc + h_sigma * np.sqrt(
            self.cc * (2 - self.cc) * mu_eff_here
        ) * y_mean

        # Rank-µ update: use top mu_eff individuals relative to old mean,
        # normalized by σ_t
        artmp = (xs[:mu_eff] - m_old) / sigma_old

        # Covariance matrix update
        C_new = (1 - self.c1 - self.cmu) * self.C
        # Rank-one part
        C_new += self.c1 * (
            np.outer(self.pc, self.pc)
            + (1 - h_sigma) * self.cc * (2 - self.cc) * self.C
        )
        # Rank-µ part
        for k in range(mu_eff):
            C_new += self.cmu * weights[k] * np.outer(artmp[k], artmp[k])

        self.C = 0.5 * (C_new + C_new.T)
        self.mean = mean_new

        # update sigma using sigma_new, clamped
        self.sigma = float(np.clip(sigma_new, self.sigma_min, self.sigma_max))

        # Keep archive size bounded (simple sliding window)
        if len(self.list_of_points) > 50:
            self.list_of_points = self.list_of_points[-30:]

    def time_warp(self, time_increment: int) -> None:
        """
        Adjust exploration level based on a "time warp".

        time_increment:
            > 0  -> move forward in time  -> less exploration (decrease sigma)
            < 0  -> move backward in time -> more exploration (increase sigma)
            = 0  -> no change

        This is an extra knob on top of the CSA-based sigma adaptation.
        """

        if time_increment == 0:
            return

        scale = self.factor_per_step ** (-time_increment)
        old_sigma = self.sigma
        self.sigma *= scale
        self.sigma = float(np.clip(self.sigma, self.sigma_min, self.sigma_max))
        
        logger.debug(
            f"CMAAgent.time_warp: time_increment={time_increment}, "
            f"sigma {old_sigma:.4f} -> {self.sigma:.4f}"
        )
