<div style="background-color: #2C3E50; color: #CCCCCC; padding: 20px; border-radius: 10px;">


# **Calculations & Important Concepts**

---

## **Health Factor**

$$\text{Health Factor = }\frac{\text{Current Value of Collateral}}{\text{Total Debt Owned} \times \text{Liquidation Threshold}}$$

Where:

- **Current Value of Collateral**: The market value of the assets used as collateral.
- **Total Debt Owed**: The sum of the borrowed amount and any accrued interest or fees.
- **Liquidation Threshold**: The ratio at which the loan is considered for liquidation.

The **Health Factor** represents the health or safety of the loan. A Health Factor greater than 1 implies a lower risk of liquidation.

---

## **Loan-to-Value(LTV) Ratio** 


$$\text{Loan-to-value Ratio = }\frac{\text{Borrowed Amount}}{\text{Current Value of Collateral} \times \text{Minimum Collateral Ratio}}$$

Where:

- **Borrowed Amount**: The total amount of money borrowed, including any accrued interest or fees.
- **Current Value of Collateral**: The market value of the assets used as collateral.
- **Minimum Collateral Ratio (MCR)**: The minimum required collateral ratio specified by the lending platform.

The **LTV ratio** represents the proportion of the borrowed amount in relation to the value of the collateral. A higher LTV ratio indicates a higher risk for the lender because it means the loan is less collateralized.

---

## **Maximum Loan-to-Value(LTV)** 


$$\text{Maximum Loan-to-value = }\frac{\text{1}}{\text{Minimum Collateral Ratio}}$$

Where:
- **Minimum Collateral Ratio (MCR)**: The minimum required collateral ratio specified by the lending platform.

The **Maximum LTV** is the maximum loanable amount for the collateral given.

---

## **Minimum Collateral Ratio (MCR)** 

The minimum collateral ratio requirement to be eligible for a loan. This is a safety measure to ensure that loans are overcollateralized, reducing the risk of loss for the lender. A ratio of 1.5 means that the collateral must be worth at least 150% of the loan value. If it falls below 150% the loan becomes eligible for liquidation or if a separate liquidation threshold is set then it will be liquidated at that threshold.

---
## **Collateral Ratio (CR)** 

This is the current collateral ratio of the collateral and loan amount. If this falls below the liquidation threshold, the position is subject to liquidation.

$$\text{CR = }\frac{a \times a_u + b \times b_u}{c \times c_u}$$

Where:
- **CR:** is the collateral ratio to determine solvency
- **a:** is the amount of locked up collateral in asset a
- **au:** is the dollar-denominated price of asset a 
- **b:** is the amount of locked up collateral in asset b
- **bu:** is the dollar-denominated price of asset b
- **c:** is the amount of loan
- **cu:** is the dollar-denomated price of the loan

---

## **Liquidation Threshold** 

The threshold for liquidation expressed as a ratio; if the collateral ratio falls below this threshold. It's usually the same ratio as MCR or lower.

---

## **Liquidity Token** 

A fungible token that represents the share of each liquidity provider.

---

<br>
<br>
<br>

# Protocol Parameters

##### This refers to the configurable variables and settings that govern the protocol’s behavior, including collateralization ratios, liquidation thresholds, loan terms, reserve ratios, etc. These parameters are essential for defining the protocol’s rules and risk management. The following parameters are essential for our model:
---

- *Minimum Collateral Ratio (MCR):* This parameter specifies the minimum ratio of collateral required relative to the loan amount to maintain the loan. If the collateral value falls below this ratio (unless there's a lower liquidation threshold) due to market fluctuations, the loan may become subject to liquidation to protect the lender from default risk.
---
- *Collateral Assets:* A list of assets that can be used as a collateral.
---
- *Liquidation Threshold:* This crucial parameter sets the boundary at which the protocol initiates the liquidation process for a loan. It's expressed as a ratio of the collateral's current market value to the loan value. When the market value of the collateral dips below this ratio, it triggers the protocol to liquidate the assets to recover the loan amount, thus mitigating the risk of default. The Liquidation Threshold is typically set below the MCR to provide a buffer zone, allowing borrowers an opportunity to add more collateral and avoid liquidation. This threshold ensures the protocol remains resilient against rapid market downturns, safeguarding both the borrower's and the lender's interests.
---
- *Minimum Loan Amount:*: The minimum loan amount sets the lowest value of funds that can be borrowed through the protocol. This parameter ensures that loans are economically viable, taking into account the operational costs and the effort required to manage and monitor loans.
---
- *Loan Term:*: This parameter defines the maximum duration for which a loan can be extended. It helps in managing the risk associated with long-term loans and ensures that loans are repaid within a reasonable timeframe, minimizing the exposure to prolonged market risks.
---
- *Protocol Usage Fee:*: The Protocol Usage Fee is a fixed charge applied each time a loan is created or repaid within the protocol. This fee is designed to cover the costs associated with the loan's administration and the provision of the protocol's services.
---
- *Liquidation Penalty Fee:*: The liquidation penalty is a fee imposed on the collateral if the loan is liquidated due to a breach of the loan terms, such as falling below the minimum collateral ratio. This penalty acts as a deterrent against risky borrowing behavior and compensates the lender for the additional risk and effort involved in liquidating the collateral.
---


<br>
<br>
<br>

---

# **References**

- Aave Protocol Documentation: https://docs.aave.com/developers/guides/liquidations
- Indigo - see references folder
- Halalend initial paper - see references folder

</div>