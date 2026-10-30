# -*- coding: utf-8 -*-
"""
Build script: Extracts and structures SAP PP SOP manual into JSON and JS data bundles.
"""
import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
os.makedirs(DATA_DIR, exist_ok=True)

knowledge_data = {
    "metadata": {
        "title": "集團 SAP PP 模組日常業務實戰與異常處置全手冊 (KU & 一線排查指南)",
        "module": "PP",
        "system_env": "集團 SAP S/4HANA (Fashion / 鞋業矩陣架構)",
        "target_audience": ["PP Key User (KU)", "生管人員", "現場排查人員 (@Triager)", "資材倉管 (MM)", "跨模組顧問"],
        "last_updated": "2026-10-16",
        "tcode_count": 68,
        "table_count": 17
    },
    
    # 1. 錯誤碼與急救排查清單 (第 8 章 + 關鍵實務陷阱)
    "issues": [
        {
            "id": "E001",
            "title": "查無工單或訂單",
            "severity": "MEDIUM",
            "category": "開單與領料",
            "trigger_tcode": ["ZPP015", "ZPP020"],
            "root_cause": "單據號碼輸入錯誤，或銷售訂單 (SO) / 工單已被業務或生管標註刪除旗標。",
            "resolution_steps": [
                "進入 VA03 核對銷售訂單狀態與各項次是否已被刪除或封鎖。",
                "進入 COOIS 選擇「訂單標頭」確認該工單是否存在且工廠代碼無誤。",
                "核對 Excel 上傳檔案中的單據號碼是否有前導零或空格遺漏。"
            ],
            "raci_owner": "PP / SD",
            "forbidden_action": "切勿未經查核即重複開立新工單，避免現場重複生產。",
            "badge": "單據異常"
        },
        {
            "id": "E002",
            "title": "尺碼不符 (Size Run Mismatch)",
            "severity": "HIGH",
            "category": "開單作業",
            "trigger_tcode": ["ZPP015"],
            "root_cause": "上傳 Excel 的 Size Run 與銷售訂單主檔之九宮格尺碼配置不一致。",
            "resolution_steps": [
                "進入 VA03 或 ZSD011 查看該 SO 項次之正式尺碼配置與數量分配矩陣。",
                "修正 Excel 表格中各尺碼行之用量配置，確保尺碼代碼完全匹配。",
                "重新上傳 ZPP015 執行轉工單。"
            ],
            "raci_owner": "PP 生管",
            "forbidden_action": "嚴禁隨意在 Excel 竄改非訂單尺碼，會造成後續裁斷與成型無法配對。",
            "badge": "尺碼九宮格"
        },
        {
            "id": "E003",
            "title": "開單大於 SO 雙數",
            "severity": "HIGH",
            "category": "開單作業",
            "trigger_tcode": ["ZPP015"],
            "root_cause": "累計開立工單數量超過該銷售訂單之原始核准訂購雙數。",
            "resolution_steps": [
                "至 COOIS 查詢該 SO 累計已開工單總雙數，核算超開量。",
                "若現場確因損耗需補單，應開立 ZP03/ZP05 補料工單 (ZPP022)，而非超開量產單。",
                "若為客戶追加數量，需通知業務於 VA02 變更 SO 數量或走挪單流程 (SIT-626)。"
            ],
            "raci_owner": "PP / SD",
            "forbidden_action": "禁止手動拆單超開，否則月結財務差異無法平帳。",
            "badge": "防超開"
        },
        {
            "id": "E005",
            "title": "已領料不可刪元件 (RESB-ENMNG > 0)",
            "severity": "CRITICAL",
            "category": "元件變更/退料",
            "trigger_tcode": ["ZPP201", "CO02", "ZPP010"],
            "root_cause": "欲變更或刪除之元件在工單中已存在實體發料扣帳紀錄 (RESB-ENMNG > 0)，系統為防帳實脫鉤啟動硬阻擋。",
            "resolution_steps": [
                "【第 1 步】：生管進入 ZPP024 (退料單維護)，選擇原工單與原首投製程建立退料單。",
                "【第 2 步】：倉庫人員至 ZMM047 (MM退料單過帳) 點收實物，執行 Mvt 262 沖銷發料，直至實領數降至 0。",
                "【第 3 步】：實領歸零後，生管進入專用程式 ZPP010 (ECN調整工單) 進行元件抽換或刪除。"
            ],
            "raci_owner": "PP (生管) + MM (倉管)",
            "forbidden_action": "💥 鐵律禁忌：切勿進 CO02 強制改元件！CO02 修改的料件脫離 BOM 關聯，會造成 ZPP020 遺失首投製程而無法拆單發料！",
            "badge": "領料防呆"
        },
        {
            "id": "E006",
            "title": "物料不存在於工廠 (MARC 遺失)",
            "severity": "MEDIUM",
            "category": "物料主檔",
            "trigger_tcode": ["ZPP010", "ZPP022", "CS01"],
            "root_cause": "該料號尚未由資材或主檔團隊擴展 (Extend) 至目標生產工廠之 MARC 視圖。",
            "resolution_steps": [
                "確認該物料基本視圖是否存在 (MM03)。",
                "通知主檔資材維護窗口，使用 MM01 / MM42 批次擴展該料號至對應生產工廠與發料儲存地點。"
            ],
            "raci_owner": "MM (資材主檔)",
            "forbidden_action": "生管切勿以替代料擅自開單，避免採購無法下 PO。",
            "badge": "主檔擴展"
        },
        {
            "id": "E007",
            "title": "預留單號與系統不符 / 資料庫鎖定",
            "severity": "HIGH",
            "category": "工單結構",
            "trigger_tcode": ["ZPP201", "CO02"],
            "root_cause": "背景同時有排程在異動工單結構，或前一手使用者未正常退出畫面導致 Table Lock 鎖定。",
            "resolution_steps": [
                "聯絡系統管理員或主管進入 SM12 查詢 Lock 物件 (特別是 AFKO / RESB 鎖定)。",
                "確認無排程批次 Job 正在運作後，執行 SM12 解鎖，重新載入工單操作。"
            ],
            "raci_owner": "IT / Basis / KU",
            "forbidden_action": "切勿在批次 Job 運作高峰期間手動強制刪鎖，避免單據資料破損。",
            "badge": "SM12 鎖定"
        },
        {
            "id": "E008",
            "title": "虛擬階不可直接發料 (SOBSL=50)",
            "severity": "HIGH",
            "category": "現場領料",
            "trigger_tcode": ["ZPP020"],
            "root_cause": "該物料於主檔或 BOM 中設定為虛擬階 (特殊採購碼 50)，純用於 BOM 結構化打包，無實體庫存帳，嚴禁直接發料。",
            "resolution_steps": [
                "檢查 BOM (CS03)，確認虛擬階組裝是否已向下穿透至底層實體原物料。",
                "若該部件確需在車間獨立控管庫存，需請工程/生管於 BOM 項目維護展開類型 Z1 (退出虛擬裝配)，將其轉為實體半品。",
                "貼合虛擬階材料若需領料，依首投製程 09 依原物料加總開立領料單。"
            ],
            "raci_owner": "BOM 組 / PP 生管",
            "forbidden_action": "嚴禁對 SOBSL=50 之料號強開實體領料單，倉庫無法過帳。",
            "badge": "虛擬階防呆"
        },
        {
            "id": "E009",
            "title": "庫存不足無法發料 (Deficit of Stock)",
            "severity": "HIGH",
            "category": "現場發料",
            "trigger_tcode": ["MIGO 261", "ZMM046"],
            "root_cause": "指定儲存地點之「未限制使用庫存」不足，料件可能卡在品檢中 (QI)、在途中或被其他預留佔用。",
            "resolution_steps": [
                "至 MB52 檢查物料庫存分佈：確認是否在庫存狀態「品質檢驗中」(QI 庫存)。",
                "若卡在品檢，聯繫 QM 品管至 QA32 儘速完成 UD 放行 (Mvt 321 轉可用)。",
                "若為儲位不符，透過 MIGO 311 辦理廠內儲位調撥後再行過帳。"
            ],
            "raci_owner": "MM (倉管) / QM (品管)",
            "forbidden_action": "禁止使用無單據手動調整庫存過帳。",
            "badge": "庫存與品檢"
        },
        {
            "id": "E010",
            "title": "工單已技術完成 (TECO) 阻擋",
            "severity": "HIGH",
            "category": "工單狀態",
            "trigger_tcode": ["CO02", "ZPP020"],
            "root_cause": "工單已被標記 TECO，物料預留單已結案關閉，禁止發料或修改。",
            "resolution_steps": [
                "若現場因瑕疵損耗需補料，標準作法應使用 ZPP022 開立 ZP03 (超耗補料工單) 領料，成本獨立歸集。",
                "若為當月尚未關帳且確屬正單漏發，生管至 CO02 點選「功能」➔「限制」➔「撤銷技術完成」，過帳後再補打 TECO。"
            ],
            "raci_owner": "PP 生管",
            "forbidden_action": "跨月已結帳工單嚴禁隨意撤銷 TECO，會嚴重破壞財務月結損益！",
            "badge": "TECO 狀態"
        },
        {
            "id": "E011",
            "title": "自動貨物異動失敗 (COGI 待處理)",
            "severity": "CRITICAL",
            "category": "報工與入庫",
            "trigger_tcode": ["CO11N", "ZPP017A"],
            "root_cause": "完工報工時背景倒扣線邊材料失敗（常見於線邊儲位庫存不足或批次被鎖定），形成 COGI 孤兒紀錄。",
            "resolution_steps": [
                "生管立即至 COGI 查詢失敗清單與錯誤訊息說明。",
                "通知資材人員以 MIGO 311 補足線邊發料儲位庫存。",
                "庫存到位後，生管回 COGI 勾選失敗項目，點擊「儲存」重新觸發過帳，直至清單歸零。"
            ],
            "raci_owner": "PP (生管) + MM (資材)",
            "forbidden_action": "月結前 COGI 必須 100% 歸零，否則財務無條件退件無法結帳！",
            "badge": "COGI 必清"
        },
        {
            "id": "E023",
            "title": "批次未達檢驗放行 (QM UD 未判定)",
            "severity": "CRITICAL",
            "category": "現場發料",
            "trigger_tcode": ["ZMM_GI_ORDER", "ZMM046", "MIGO"],
            "root_cause": "該批次原料屬於品管列管物料，收貨入庫後尚未由品管於 QA32 判定使用決策 (UD 放行)。",
            "resolution_steps": [
                "記下報錯訊息中的物料代碼與檢驗批號碼 (Inspection Lot)。",
                "緊急通知廠區品管 (QM) 人員進入 QA32 / QA11 錄入檢驗特性值並執行 UD (Usage Decision) 合格放行。",
                "放行後庫存轉為自由可用 (Status 35)，倉庫即可在 ZMM046 正常過帳發料。"
            ],
            "raci_owner": "QM (品管負責放行)",
            "forbidden_action": "未經品管判定前，嚴禁繞道使用非管制儲位強制發料，避免重大品質事故！",
            "badge": "QM 門檻"
        },
        {
            "id": "LOCK_ZMMT046",
            "title": "領料單無法刪除 (備料單處理中)",
            "severity": "HIGH",
            "category": "領料單防呆",
            "trigger_tcode": ["ZPP020"],
            "root_cause": "倉庫已在 ZMM046 / ZMM046M 產生備料單，且狀態為 I (待處理) 或 M (處理中)，系統自動上鎖保護。",
            "resolution_steps": [
                "檢查 Table ZMMT046 該領料單之 ZZSTATUS 旗標。",
                "生管聯絡倉庫人員至 ZMM046 找到該筆備料單，執行「取消備料單」或「復原狀態」。",
                "倉庫狀態復原後，生管即可在 ZPP020 依銷售訂單號查詢並整張刪除領料單。"
            ],
            "raci_owner": "PP (生管) + MM (倉庫)",
            "forbidden_action": "嚴禁僅按單一工單勾選刪除，必須依「銷售訂單號」整張作廢，避免項次殘留！",
            "badge": "ZMMT046 狀態"
        },
        {
            "id": "RET_ZMM047_FAIL",
            "title": "ZMM047 退料過帳失敗",
            "severity": "HIGH",
            "category": "現場退料",
            "trigger_tcode": ["ZMM047"],
            "root_cause": "退料單關聯之工單已 TECO 結案，或申請退料數量大於該工單之累計領料數量 (RESB-ENMNG)。",
            "resolution_steps": [
                "進入 COOIS (清單選元件) 查核該元件之實際『領料數量』(Withdrawn Quantity)。",
                "若退料量大於實領量，生管需作廢原退料單並在 ZPP024 重開正確數量。",
                "若工單已 TECO，生管至 CO02 暫時撤銷 TECO，倉管過帳完成後立刻重新打上 TECO。"
            ],
            "raci_owner": "MM (倉庫) / PP (生管)",
            "forbidden_action": "嚴禁跨工單或跨製程混退，否則月結會產生重工借貸尾差。",
            "badge": "退料過帳"
        },
        {
            "id": "MISSING_FIRST_PROC",
            "title": "改單後領料單無首投製程 (無法拆單)",
            "severity": "CRITICAL",
            "category": "工單元件",
            "trigger_tcode": ["ZPP020", "CO02"],
            "root_cause": "現場或生管在 CO02 手動修改工單元件，導致料件脫離 BOM 關聯，無法帶入首投製程 (STPO-ZZFIRST)。",
            "resolution_steps": [
                "進 CO02 將手動新增或修改之元件予以刪除標記。",
                "使用鞋業專用 ECN 改單程式 ZPP010 重新進行元件調整，程式會自動匹配部位並帶出首投製程。",
                "改單完成後，重新至 ZPP020 預覽並儲存領料單。"
            ],
            "raci_owner": "PP 生管",
            "forbidden_action": "💥 大忌：手動進 CO02 改料件！必須 100% 使用 ZPP010！",
            "badge": "首投製程"
        },
        {
            "id": "DEFAULT_ROUTING_ERR",
            "title": "轉工單提示預設值未維護 (未維護訂單類型ZP02作業產生的預設值)",
            "severity": "MEDIUM",
            "category": "生產版本",
            "trigger_tcode": ["ZPP015A", "FSH_PCW", "CO01"],
            "root_cause": "C223 生產版本之有效開始日期 (Valid From) 早於標準途程 (Routing) 之生效日期。",
            "resolution_steps": [
                "進入 CA03 查詢該成品標準途程之正式生效日期 (Valid-From Date)。",
                "進入 C223 (或大量維護 ZC223)，將該生產版本的有效開始日期調整為大於或等於途程生效日。",
                "點擊檢查確認燈號亮綠燈後存檔，重新轉開工單。"
            ],
            "raci_owner": "PP 生管 / BOM 組",
            "forbidden_action": "切勿忽視 C223 綠燈檢查，黃燈或紅燈狀態嚴禁下發排產。",
            "badge": "生產版本"
        },
        {
            "id": "VA_BOM_DECOUPLED",
            "title": "GA BOM 與 VA BOM 不一致 (九宮格脫鉤/漏料)",
            "severity": "CRITICAL",
            "category": "BOM 主檔",
            "trigger_tcode": ["CS02", "COOIS", "MD01N"],
            "root_cause": "ECN 變更後母階 GA 有新料，但子階 VA 漏料，Table FSH_BOM_VD.V_STLNR 為空脫鉤，導致材料漏買。",
            "resolution_steps": [
                "【方式 A (批次自動修復)】：執行專案修復程式 ZPPBOMFIX，並可在 SLG1 物件 FSH_BOM 查核修復 Log。",
                "【方式 B (手工重刷九宮格)】：進 CS02 帶入 ECN 號碼 ➔ 點選異常項次元件 ➔ 開啟九宮格 ➔ 清除 VA 對應用量存檔 ➔ 再次進九宮格填回用量存檔，強迫系統重寫 FSH_BOM_VD。"
            ],
            "raci_owner": "BOM 組 / KU",
            "forbidden_action": "發現母子階脫鉤切勿置之不理，否則後續採購與現場針車成型將全數停工缺料！",
            "badge": "Fashion 九宮格"
        },
        {
            "id": "E_SUB_NO_ME11",
            "title": "委外工序缺乏採購資訊記錄 (ME11 遺失)",
            "severity": "CRITICAL",
            "category": "工序委外",
            "trigger_tcode": ["CO02", "ZPP019", "ME21N"],
            "root_cause": "途程工序控制碼設為 PP02，但採購端未在 ME11 建立對應供應商之委外加工資訊記錄 (資訊類別 3)，導致工單釋放時 PR 產生異常或採購開立 PO 阻擋。",
            "resolution_steps": [
                "【第 1 步】：通知採購人員至 ME11 針對該工序物料與供應商維護採購資訊記錄，資訊類別務必選取『3 (委外加工)』。",
                "【第 2 步】：在 ME11 維護加工淨價、稅碼、計畫交貨天數與採購組織參數並儲存。",
                "【第 3 步】：生管至 CO02 重新讀取途程工序外部處理資料，或於工單釋放 (REL) 重新觸發產生正確委外 PR。"
            ],
            "raci_owner": "MM (採購) + PP (生管)",
            "forbidden_action": "切勿將工序控制碼擅自改回 PP01 廠內報工，否則將導致現場無人報工且加工費無法請款！",
            "badge": "委外主檔"
        },
        {
            "id": "E_SUB_541_LACK",
            "title": "外協供應商在庫不足 (541 未轉撥導致 101/543 失敗)",
            "severity": "HIGH",
            "category": "工序委外",
            "trigger_tcode": ["MIGO", "ME2O", "ME27"],
            "root_cause": "外協加工品送回廠內，倉管於 MIGO 執行 101 採購收貨時，系統背景觸發 Mvt 543 倒扣供應商處之原材料，但先前未執行 Mvt 541 發料或發料數量不足，導致『Deficit of SC stock (外協庫存短缺)』報錯阻擋！",
            "resolution_steps": [
                "【第 1 步】：倉管或資材至 ME2O (供應商外協庫存監控報表) 查核該供應商代碼名下之原材料特殊庫存結存。",
                "【第 2 步】：若庫存為 0 或短缺，至 MIGO 選擇 A08移轉過帳 ➔ R08生產訂單 (或 ME27)，執行 Mvt 541 將廠內原料移轉至供應商庫存。",
                "【第 3 步】：補足供應商特殊庫存後，重新回到 MIGO 執行 A01收貨 ➔ R01採購單過帳 101，系統即可順利自動帶出 543 扣帳並將 PP02 工序自動確認完工！"
            ],
            "raci_owner": "MM (倉管) + PP (生管)",
            "forbidden_action": "嚴禁在 MIGO 勾銷 543 耗用明細強制過帳 101，這會造成供應商無料卻產出加工品，帳實嚴重脫節！",
            "badge": "外協庫存"
        }
    ],

    # 2. 工單類型體系 ZP01~ZP07 全場景矩陣 (第 0.1 & 0.2 章)
    "order_types": [
        {
            "type": "ZP01",
            "name": "試量生產工單",
            "scenario": "開發 / 試產 / 試做鞋型小批量試量投產。無正式客戶訂單，產成品由技轉或研發保留。",
            "trigger_tcode": "CO01 / FSH_PCW",
            "pick_type": "正單 (ZP01 / ZP02)",
            "cost_rule": "歸集至開發 / 試產專案成本 (SIT-609)。",
            "mes_dispatch": "不派工 (X)",
            "sap_confirm": "手動報工 (V)",
            "mes_upload": "不對接 (X)",
            "auto_gr": "成品入庫 (V)",
            "key_note": "無 SO 派工需求，MES 輪次不派工，由生管在 SAP 手動報工，完工後 101 入庫作為技轉樣品。"
        },
        {
            "type": "ZP02",
            "name": "量產工單",
            "scenario": "業務正式接單 (MTO 大貨量產 / MTS)，依客戶訂單出貨之核心主力工單。",
            "trigger_tcode": "FSH_PCW / ZPP015",
            "pick_type": "正單 (ZP01 / ZP02)",
            "cost_rule": "必填利潤中心，成本結轉至庫存產成品與銷貨成本。",
            "mes_dispatch": "派工 (V)",
            "sap_confirm": "報工 (V)",
            "mes_upload": "上傳 MES (V)",
            "auto_gr": "成品入庫 (V)",
            "key_note": "全自動化介接核心！MES 派工輪次排產，報工自動扣料，末站 PP03 自動 101 入庫。"
        },
        {
            "type": "ZP03",
            "name": "超耗單補料工單",
            "scenario": "現場加工不良、人為報廢或材料瑕疵需超額個別補料（正單尚未入庫完成）。",
            "trigger_tcode": "ZPP022",
            "pick_type": "補料工單 (ZP03 / ZP05)",
            "cost_rule": "成本獨立歸集至該補料工單，利於月結進行超耗異常分析。",
            "mes_dispatch": "不派工 (X)",
            "sap_confirm": "不報工 (X)",
            "mes_upload": "不對接 (X)",
            "auto_gr": "不入庫 (X)",
            "key_note": "⚠️ 關鍵：正單未入庫前的缺料補料！不走 MES 報工與入庫，純開立領料單補料回線邊。"
        },
        {
            "type": "ZP04",
            "name": "包裝工單",
            "scenario": "成品鞋裝箱、加附吊牌、貼標或 VAS 客製化加值包裝（不展 BOM 架構）。",
            "trigger_tcode": "CO07",
            "pick_type": "包裝工單 (ZP04)",
            "cost_rule": "領用包裝材（外箱、吊牌、乾燥劑），結算至銷貨成本-重工 G/L 51110099。",
            "mes_dispatch": "不派工 (X)",
            "sap_confirm": "不報工 (X)",
            "mes_upload": "不對接 (X)",
            "auto_gr": "不入庫 (X)",
            "key_note": "外包材不展階、不進 MES、不入庫，直接領料扣帳並結轉重工科目 51110099。"
        },
        {
            "type": "ZP05",
            "name": "成套補料工單",
            "scenario": "正單已完成入庫結案後產生的 B / C 品，需成套補料重新投產。",
            "trigger_tcode": "ZPP022",
            "pick_type": "補料工單 (ZP03 / ZP05)",
            "cost_rule": "結算規則自動帶，完整走 MES 派工與報工入庫流程。",
            "mes_dispatch": "派工 (V)",
            "sap_confirm": "報工 (V)",
            "mes_upload": "上傳 MES (V)",
            "auto_gr": "成品入庫 (V)",
            "key_note": "⚠️ 與 ZP03 截然不同：ZP05 為入庫結案後整套重做，必須完整走 MES 派工、報工與入庫流程！"
        },
        {
            "type": "ZP06",
            "name": "全代工工單 (委託廠)",
            "scenario": "全製程委外代工時，委託方於系統中開立之追蹤工單。",
            "trigger_tcode": "ZPP015 / CO08",
            "pick_type": "委託廠代工領料單",
            "cost_rule": "追蹤外發原物料耗用與代工成品驗收入庫；受託廠端不對接本廠 SAP 報工。",
            "mes_dispatch": "同品牌受託廠",
            "sap_confirm": "不報工 (X)",
            "mes_upload": "不對接 (X)",
            "auto_gr": "驗收入庫 (V)",
            "key_note": "追蹤外發原物料耗用與成品驗收入庫，受託廠現場不直接對接本廠 SAP 報工。"
        },
        {
            "type": "ZP07",
            "name": "製程代工工單 (受託廠)",
            "scenario": "承接集團內其他廠區委託代工生產時開立之製程工單（受託廠不需要完整成品 BOM / 途程）。",
            "trigger_tcode": "CO07",
            "pick_type": "受託廠領料單",
            "cost_rule": "結算至銷貨成本-加工 51110002，由受託廠在 SAP 報工，不對接 MES 產量。",
            "mes_dispatch": "不派工 (X)",
            "sap_confirm": "SAP報工 (V)",
            "mes_upload": "不對接 (X)",
            "auto_gr": "不入庫 (X)",
            "key_note": "受託廠無需成品 BOM/途程，結算至加工成本 51110002，純在 SAP 手動報工。"
        }
    ],

    # 3. 8 大途程控制碼矩陣 (第 1.3 章)
    "control_keys": [
        {
            "key": "PP01",
            "type": "廠內自製",
            "confirm": "2 (需要確認)",
            "external": "無",
            "auto_gr": "否 (手動 101)",
            "schedule_cost": "算排程 / 成本",
            "desc": "標準核心工序。裁斷、針車、成型等核心站，現場完工必須手動進系統報工；末站若為 PP01 需手動 MIGO 101 入庫。"
        },
        {
            "key": "PP02",
            "type": "委外代工",
            "confirm": "不可報工 (空白)",
            "external": "+ (委外外協)",
            "auto_gr": "否",
            "schedule_cost": "算委外交期",
            "desc": "工序委外加工。工單釋放時自動開立採購申請 (PR)，廠內不報工，廠商交貨時透過 MIGO 101 採購收貨即視為完工。"
        },
        {
            "key": "PP03",
            "type": "廠內自製",
            "confirm": "2 (需要確認)",
            "external": "無",
            "auto_gr": "✔ 自動入庫",
            "schedule_cost": "算排程 / 成本",
            "desc": "最後一站自動入庫。手動報工完工瞬間，背景自動過帳 101 成品收貨！⚠️ 鐵律：整張工單只能放一次且必須在最後一站，多放將失效！"
        },
        {
            "key": "PP04",
            "type": "廠內自製",
            "confirm": "2 (需要確認)",
            "external": "無",
            "auto_gr": "否",
            "schedule_cost": "算排程 / 成本",
            "desc": "含品管檢驗。釋放時自動觸發 QM 03 檢驗批，品管必須於 QA32 錄入檢驗特性數據並做 UD 放行。"
        },
        {
            "key": "PP05",
            "type": "廠內自製",
            "confirm": "1 (里程碑確認)",
            "external": "無",
            "auto_gr": "否",
            "schedule_cost": "算排程 / 成本",
            "desc": "里程碑報工（買一送多）。報工本站時，系統自動把前面所有尚未報工的自製工序一併完成報工，適合多道連續站之關鍵節點。"
        },
        {
            "key": "PP06",
            "type": "委外代工",
            "confirm": "1 (里程碑確認)",
            "external": "+ (委外外協)",
            "auto_gr": "否",
            "schedule_cost": "不算廠內排程",
            "desc": "委外 + 里程碑。外協廠商做完送回，倉庫執行委外收貨 (MIGO 101) 時，自動將該站及前面所有廠內漏報工序一併補齊！"
        },
        {
            "key": "PP07",
            "type": "委外代工",
            "confirm": "不可報工 (空白)",
            "external": "+ (委外外協)",
            "auto_gr": "✔ 自動入庫",
            "schedule_cost": "算委外交期",
            "desc": "委外即為最後一站。外包加工為最後一道工序，廠商送回倉庫刷委外收貨時，連同整張生產工單成品入庫一次自動辦完。"
        },
        {
            "key": "PP08",
            "type": "廠內自製",
            "confirm": "1 (里程碑確認)",
            "external": "無",
            "auto_gr": "✔ 自動入庫",
            "schedule_cost": "算排程 / 成本",
            "desc": "自製終極大招 (PP05 + PP03)。放在最後一站，現場只需刷此站報工，自動完成：『前面所有站補報工』+『成品 101 自動入庫』！"
        },
        {
            "key": "PP99",
            "type": "純文字",
            "confirm": "3 (不可能確認)",
            "external": "無",
            "auto_gr": "否",
            "schedule_cost": "不算排程 / 成本",
            "desc": "備註便簽工序。不計產能、不計成本、無法報工。純用於現場看備註（如靜置冷卻）或接 MES 虛擬節點。"
        }
    ],

    # 4. 跨部門 RACI Matrix (第 0.3 章)
    "raci_matrix": [
        {"process": "1. 品牌部位與 BOM 建立", "pp": "C", "bom": "R / A", "sd": "I", "mm": "C", "qm": "I", "co": "C", "output": "部位 ZPP001、BOM CS01、九宮格分配檔維護"},
        {"process": "2. 途程與工作中心維護", "pp": "C", "bom": "R / A", "sd": "I", "mm": "I", "qm": "C", "co": "A", "output": "工作中心 CR01 指派成本中心、途程 CA01 設定控制碼"},
        {"process": "3. 生產版本綁定 (C223)", "pp": "R", "bom": "C", "sd": "I", "mm": "I", "qm": "I", "co": "I", "output": "狀態亮綠燈，生效日期 >= 途程生效日期"},
        {"process": "4. 需求建立 (SO / PIR)", "pp": "C", "bom": "I", "sd": "R (SO)", "mm": "I", "qm": "I", "co": "I", "output": "業務 VA01 開立 SO，生管 MD61 / ZPP006 上傳 PIR"},
        {"process": "5. 執行 MRP / MPS", "pp": "R / A", "bom": "I", "sd": "I", "mm": "I", "qm": "I", "co": "I", "output": "正式 SO 跑 MD01N 產計畫單與 PR；PIR 跑 MS01 / MSBT"},
        {"process": "6. 計畫單轉量產工單", "pp": "R / A", "bom": "I", "sd": "I", "mm": "I", "qm": "I", "co": "I", "output": "FSH_PCW 轉 ZP02，確認利潤中心與卸貨點必填"},
        {"process": "7. 需求追蹤號綁定 (ZPP042)", "pp": "R", "bom": "I", "sd": "I", "mm": "C", "qm": "I", "co": "I", "output": "請購轉採購後執行 ZPP042，為 MTS 材料回填 PO 追蹤號"},
        {"process": "8. 開立分批領料單 (ZPP020)", "pp": "R / A", "bom": "I", "sd": "I", "mm": "I", "qm": "I", "co": "I", "output": "依成型日與首投製程拆單，避免單據殘留"},
        {"process": "9. 倉庫發料過帳 (MIGO 261)", "pp": "I", "bom": "I", "sd": "I", "mm": "R / A", "qm": "C (UD)", "co": "I", "output": "倉儲 ZMM046 掃碼過帳扣帳，檢驗品需 QM 放行 (E023)"},
        {"process": "10. 現場退料與元件變更", "pp": "R (退/改)", "bom": "C", "sd": "I", "mm": "R (262)", "qm": "I", "co": "I", "output": "生管 ZPP024 申請 -> 倉儲 ZMM047 過帳 -> 生管 ZPP010 改單"},
        {"process": "11. 完工報工與成品入庫", "pp": "R (報工)", "bom": "I", "sd": "I", "mm": "R (入庫)", "qm": "C (QA32)", "co": "I", "output": "現場報工，PP03 自動 101 入庫或倉儲手動 101 收貨"},
        {"process": "12. COGI 異常清理", "pp": "R", "bom": "I", "sd": "I", "mm": "C (補庫)", "qm": "I", "co": "I", "output": "生管查核倒扣失敗料件，資材補足儲位後重新過帳歸零"},
        {"process": "13. 工單技術完成 (TECO)", "pp": "R", "bom": "I", "sd": "I", "mm": "C", "qm": "I", "co": "A", "output": "COOIS 結案四重稽核通過後，生管下達 TECO 關閉預留"},
        {"process": "14. 成本月結計算與結算", "pp": "I", "bom": "I", "sd": "I", "mm": "I", "qm": "I", "co": "R / A", "output": "財務執行 KKS2 計算差異並於 CO88 結算工單損益"}
    ],

    # 5. 互動式診斷決策樹
    "decision_trees": {
        "mrp_tree": {
            "title": "MRP 跑不出資料六步標準排查樹 (第 2.7 節)",
            "root_question": "業務告知已下單，但生管在 MD01N / MD04 查無計畫單或採購請購單？",
            "steps": [
                {
                    "step_id": 1,
                    "name": "查核 SO 是否拋轉工廠 (6單 vs C單)",
                    "tcode": "VA03",
                    "check": "在 VA03 查詢銷售訂單，確認是 6 開頭（貿易公司單）還是 C 開頭（廠區工廠單）？",
                    "options": [
                        {"label": "有 6 單，但完全查不到對應的 C 單", "status": "FAIL", "msg": "💥 跨公司拋轉中斷！貿易公司單未成功拋至工廠。責任方：【SD 業務模組】。請 SD 人員排查 ZMM091 / ZSD013 批次拋轉 Job。生管切勿私自手動開單！"},
                        {"label": "C 開頭工廠訂單存在且正常", "status": "PASS", "next_step": 2}
                    ]
                },
                {
                    "step_id": 2,
                    "name": "查核 SO 是否已取消或填寫拒絕原因",
                    "tcode": "VA03",
                    "check": "檢查 C 單表頭與各項次，是否有維護拒絕原因 (如 Z3 或取消碼)？",
                    "options": [
                        {"label": "項次已被標註拒絕原因", "status": "FAIL", "msg": "⚠️ 該訂單項次已被業務單位取消或結案！請與廠區業務 (SD) 確認是否誤退單或已挪單。"},
                        {"label": "未取消，無拒絕原因", "status": "PASS", "next_step": 3}
                    ]
                },
                {
                    "step_id": 3,
                    "name": "查核 SO 變更歷史 (交期/尺碼異動)",
                    "tcode": "VA03",
                    "check": "點選頂部選單「環境」➔「更改」➔「執行」，核對業務最新變更紀錄。",
                    "options": [
                        {"label": "交期已被推遲、數量變更或尺碼調整", "status": "FAIL", "msg": "💡 業務近期修改了交期或數量，MRP 會依新交期重新運算落入不同時間桶，請至 MD04 推前推後日期重新核對。"},
                        {"label": "訂單無異常變更", "status": "PASS", "next_step": 4}
                    ]
                },
                {
                    "step_id": 4,
                    "name": "檢查成品 BOM 是否建立並生效",
                    "tcode": "CS03",
                    "check": "進入 CS03 查核該鞋型 BOM：有效日期是否小於等於需求日期？Fashion 九宮格是否完整？",
                    "options": [
                        {"label": "查無 BOM，或 BOM 生效日晚於訂單需求日", "status": "FAIL", "msg": "💥 BOM 主檔缺失或生效日期落後！責任方：【BOM 組】。通知 BOM 組在 CS02 修正 ECN 生效日或補建 BOM。"},
                        {"label": "BOM 存在且已生效", "status": "PASS", "next_step": 5}
                    ]
                },
                {
                    "step_id": 5,
                    "name": "檢查標準途程 (Routing) 是否核發",
                    "tcode": "CA03",
                    "check": "進入 CA03 查詢途程：狀態是否為『4 (已核發)』？有效期間是否涵蓋需求日？",
                    "options": [
                        {"label": "無途程，或途程狀態仍處於建立/未核發", "status": "FAIL", "msg": "⚠️ 途程未核發！責任方：【工程部 / 生管】。進入 CA02 將途程狀態改為『4 (已核發)』存檔。"},
                        {"label": "途程狀態正常 (狀態 4 已核發)", "status": "PASS", "next_step": 6}
                    ]
                },
                {
                    "step_id": 6,
                    "name": "檢查生產版本四合一綁定 (C223)",
                    "tcode": "C223",
                    "check": "進入 C223 輸入工廠與料號，點選『檢查』：狀態是否全亮綠燈？生效日是否大於等於途程生效日？",
                    "options": [
                        {"label": "亮紅燈/黃燈，或有效起始日小於途程生效日", "status": "FAIL", "msg": "💥 生產版本異常！進入 C223 補齊途程綁定，並確保版本有效開始日 >= 途程生效日，存檔重新檢查至綠燈。"},
                        {"label": "生產版本全亮綠燈", "status": "PASS", "next_step": 7}
                    ]
                },
                {
                    "step_id": 7,
                    "name": "物料主檔與淨更改規劃檢核",
                    "tcode": "ZPPQ01 / SE16N",
                    "check": "至 ZPPQ01 檢查物料狀態無作廢碼 (ZZ) 且估價完成 (20)；至 SE16N 查 Table PPH_DBVM。",
                    "options": [
                        {"label": "PPH_DBVM 淨更改標記為 X 且時間早於目前", "status": "INFO", "msg": "💡 主檔齊全！該物料目前待跑 MRP，使用 MD02 手動重跑單一物料即可立刻產出計畫單與 PR。"}
                    ]
                }
            ]
        },
        "return_tree": {
            "title": "現場退料與元件抽換防呆鏈條 (第 5.1 & 5.2 節)",
            "root_question": "現場需要退料或抽換工單元件，但遇到系統阻擋 (E005)？",
            "steps": [
                {
                    "step_id": 1,
                    "name": "查核工單元件是否已實體領料扣帳",
                    "tcode": "COOIS",
                    "check": "進入 COOIS (清單選元件)，核對該料件之『領料數量 (RESB-ENMNG)』是否大於 0？",
                    "options": [
                        {"label": "領料數量 = 0 (尚未發料)", "status": "SAFE", "msg": "✅ 尚未發料：生管可直接進入 ZPP010 (ECN 調整工單) 進行元件抽換或數量修改。(⚠️ 嚴禁進 CO02 修改！)"},
                        {"label": "領料數量 > 0 (已實體領料扣帳)", "status": "LOCKED", "next_step": 2}
                    ]
                },
                {
                    "step_id": 2,
                    "name": "發起現場退料單申請",
                    "tcode": "ZPP024",
                    "check": "生管至 ZPP024，選擇原工單與『原首投製程』，開立退料單並列印交付倉庫。",
                    "options": [
                        {"label": "退料單已開立並列印完成", "status": "PASS", "next_step": 3}
                    ]
                },
                {
                    "step_id": 3,
                    "name": "倉庫點收實物並過帳 (Mvt 262)",
                    "tcode": "ZMM047",
                    "check": "倉庫人員進入 ZMM047 輸入退料單號點收實物，執行 262 沖銷過帳。",
                    "options": [
                        {"label": "262 過帳成功，RESB-ENMNG 實領數沖銷歸零", "status": "PASS", "next_step": 4},
                        {"label": "過帳失敗：工單已 TECO 或退料量大於領料數量", "status": "FAIL", "msg": "⚠️ 核對領料數量；若已 TECO，生管至 CO02 暫撤 TECO，過帳後再打回 TECO。"}
                    ]
                },
                {
                    "step_id": 4,
                    "name": "解鎖 E005，使用專用程式變更元件",
                    "tcode": "ZPP010",
                    "check": "實領數歸零後，生管進入 ZPP010 抽換或刪除元件。",
                    "options": [
                        {"label": "變更完成，系統自動匹配首投製程與 BOM 關聯", "status": "SAFE", "msg": "🎉 成功閉環！後續 ZPP020 領料單將能精確依首投製程拆單發料。"}
                    ]
                }
            ]
        },
        "order_transfer_tree": {
            "title": "SIT-626 業務訂單挪單 (Order Transfer) 生管處置流程 (第 5.4 節)",
            "root_question": "業務在 VA02 將訂單挪單 (SO-A 挪至 SO-B)，生管工單如何處置？",
            "steps": [
                {
                    "step_id": 1,
                    "name": "查核工單是否已有實體領料扣帳 (RESB-ENMNG)",
                    "tcode": "COOIS",
                    "check": "確認原 SO-A 關聯之工單是否已領料？",
                    "options": [
                        {"label": "尚未領料 (RESB-ENMNG = 0)", "status": "SAFE", "msg": "1. 至 ZPP020 依原 SO-A 整張作廢刪除領料單。<br>2. 進入 CO02 修改工單表頭之『卸貨點 (Unloading Point)』為新 SO-B 號碼；或於 COHV 標記刪除後由 FSH_PCW 重新開立。"},
                        {"label": "已實體發料 (RESB-ENMNG > 0)", "status": "LOCKED", "next_step": 2}
                    ]
                },
                {
                    "step_id": 2,
                    "name": "材料規格是否與新訂單完全共用？",
                    "tcode": "CS03",
                    "check": "比對 SO-A 與 SO-B 用料是否一致？",
                    "options": [
                        {"label": "完全共用", "status": "SAFE", "msg": "生管配合資材透過 MB21 / MIGO 311 辦理專案庫存移轉，業務端辦理物料轉撥至新 SO。嚴禁直接刪單！"},
                        {"label": "規格不同需抽換材料", "status": "WARN", "msg": "依 5.1 節透過 ZPP024 開立退料單 ➔ 倉管 ZMM047 (Mvt 262) 退料歸零 ➔ 生管 ZPP010 換料 ➔ 重開 ZPP020 領料單。"}
                    ]
                }
            ]
        }
    },

    # 6. 月結與工單 TECO 互動自檢清單 (第 7 章)
    "teco_checklist": [
        {
            "id": "chk_cogi",
            "step": "步驟 1",
            "title": "COGI 失敗物料異動清理",
            "tcode": "COGI",
            "detail": "進入 COGI 輸入工廠代碼查詢，清單必須 100% 歸零！若有失敗記錄，通知資材以 MIGO 311 補足線邊儲位庫存後儲存重新過帳。",
            "critical": True
        },
        {
            "id": "chk_coois_withdrawn",
            "step": "步驟 2A",
            "title": "COOIS 查核未領料件 (需求數量 vs 領料數量)",
            "tcode": "COOIS",
            "detail": "COOIS 清單選擇『元件』，篩選『需求數量 > 領料數量』，確認是否有應發未發料件，避免線上缺料假性完工。",
            "critical": True
        },
        {
            "id": "chk_coois_gr_diff",
            "step": "步驟 2B",
            "title": "COOIS 查核報工與入庫數量差異",
            "tcode": "COOIS",
            "detail": "COOIS 清單選擇『訂單標頭』，核對『工單數量 vs 交付數量』，確認產成品是否已全數入庫 (末站 PP03 自動入庫或 MIGO 101)。",
            "critical": True
        },
        {
            "id": "chk_coois_subcontract",
            "step": "步驟 2C",
            "title": "COOIS 查核製程委外採購申請 (PP02 PR/PO)",
            "tcode": "COOIS",
            "detail": "COOIS 清單選擇『採購申請』，核對該工單若有委外工序 (PP02)，外協 PR / PO 是否已全數交貨收貨完成。",
            "critical": False
        },
        {
            "id": "chk_settlement_rule",
            "step": "步驟 3",
            "title": "工單結算規則與利潤中心查核",
            "tcode": "CO03",
            "detail": "檢視工單標頭『結算規則』：類別 MAT/CTR 比率需為 100%，確認利潤中心有填，防止 CO88 結算拋錯。",
            "critical": True
        },
        {
            "id": "chk_teco_exec",
            "step": "步驟 4",
            "title": "執行工單技術完成 (TECO)",
            "tcode": "CO02 / FSH_PCW",
            "detail": "單張工單於 CO02 執行 TECO；主檔工單於 FSH_PCW 或批次 COHV 下達 TECO。系統即刻關閉物料預留單釋放額度。",
            "critical": True
        }
    ],

    # 7. 68 大 T-Code 字典 (依手冊 YAML 規格完整 68 個交易碼 + 跨情境標註)
    "tcodes": [
        {"code": "ZPP001", "name": "品牌部位代碼維護", "category": "基礎主檔", "role": "BOM組 / 生管", "desc": "維護鞋面、鞋舌、鞋帶等裁斷部位代號，自動帶出首投製程 (STPO-ZZFIRST)。", "scenarios": ["【場景 1】PP 基礎主檔建置標準循序"]},
        {"code": "CS01", "name": "建立物料清單 (BOM)", "category": "基礎主檔", "role": "BOM組", "desc": "維護 Fashion BOM，配置排序字串 (部位) 與替代料群組 A1 及九宮格分配。", "scenarios": ["【場景 1】PP 基礎主檔建置標準循序"]},
        {"code": "CS02", "name": "修改物料清單 (BOM)", "category": "基礎主檔", "role": "BOM組", "desc": "綁定 ECN 號碼調整 BOM，九宮格尺碼分配與替代料調整。", "scenarios": ["【場景 1】PP 基礎主檔建置標準循序", "【場景 6】現場退料與 ECN 抽換元件循序"]},
        {"code": "CS03", "name": "顯示物料清單 (BOM)", "category": "基礎主檔", "role": "BOM組 / 生管", "desc": "查核 BOM 項目、有效日期與母階 (GA) / 子階 (VA) 結構及替代料。", "scenarios": ["【場景 1】PP 基礎主檔建置標準循序", "【場景 2】正式訂單需求運算循序"]},
        {"code": "ZPP002", "name": "BOM 上傳與下載", "category": "基礎主檔", "role": "BOM組", "desc": "Excel 批次上傳與下載鞋業 Fashion BOM 主檔與尺碼分配檔。", "scenarios": ["【場景 1】PP 基礎主檔建置標準循序"]},
        {"code": "CC01", "name": "建立工程變更號碼 (ECN)", "category": "工程變更", "role": "開發部 / BOM組", "desc": "建立工程變更表頭 (AENR)，定義生效日期，作為改單與改 BOM 授權號碼。", "scenarios": ["【場景 6】現場退料與 ECN 抽換元件循序"]},
        {"code": "CC02", "name": "修改工程變更號碼 (ECN)", "category": "工程變更", "role": "開發部 / BOM組", "desc": "修改 ECN 說明、擴展變更物料項目清單或調整核准狀態。", "scenarios": ["【場景 6】現場退料與 ECN 抽換元件循序"]},
        {"code": "CR01", "name": "建立工作中心 (Work Center)", "category": "基礎主檔", "role": "工程部 / 生產部", "desc": "定義產線裁斷、針車、成型工作中心並指定對應成本中心與標準值碼。", "scenarios": ["【場景 1】PP 基礎主檔建置標準循序"]},
        {"code": "CA01", "name": "建立標準途程 (Routing)", "category": "基礎主檔", "role": "工程部 / 生管", "desc": "維護工序、控制碼 (PP01~PP08) 與標準作業工時 (直接人工/機器)。", "scenarios": ["【場景 1】PP 基礎主檔建置標準循序", "【場景 8】委外加工發包與收貨循序"]},
        {"code": "CA03", "name": "顯示標準途程", "category": "基礎主檔", "role": "生管 / 現場", "desc": "查核途程核發狀態 (狀態 4: 已核發) 與各站控制碼、標準工時配置。", "scenarios": ["【場景 1】PP 基礎主檔建置標準循序", "【場景 8】委外加工發包與收貨循序"]},
        {"code": "ZPP003", "name": "途程批次上傳", "category": "基礎主檔", "role": "工程部", "desc": "Excel 批次上傳工序清單、標準工時與控制碼，快速建立型體途程。", "scenarios": ["【場景 1】PP 基礎主檔建置標準循序"]},
        {"code": "C223", "name": "維護生產版本", "category": "基礎主檔", "role": "生管 / BOM組", "desc": "BOM 與途程四合一綁定，檢查綠燈，有效日期需大於等於途程生效日。", "scenarios": ["【場景 1】PP 基礎主檔建置標準循序"]},
        {"code": "ZC223", "name": "生產版本批次上傳", "category": "基礎主檔", "role": "生管", "desc": "批次建立多個型體與尺碼變體之生產版本四合一關聯。", "scenarios": ["【場景 1】PP 基礎主檔建置標準循序"]},
        {"code": "MD01N", "name": "MRP Live 運算", "category": "需求規劃", "role": "生管 (PP)", "desc": "正式銷售訂單 (MTO) 大貨量產 MRP 運算，產出計畫單與 PR。", "scenarios": ["【場景 2】正式訂單需求運算循序"]},
        {"code": "MD02", "name": "單一物料多階 MRP 運算", "category": "需求規劃", "role": "生管 (PP)", "desc": "單一物料多階精確運算，適用於樣品鞋、急單或特定型體重新運算。", "scenarios": ["【場景 2】正式訂單需求運算循序"]},
        {"code": "MD04", "name": "庫存需求清單動態查核", "category": "需求規劃", "role": "生管 / 資材", "desc": "即時查驗單一物料之供給 (PO/工單) 與需求 (SO/預留) 供需平衡。", "scenarios": ["【場景 2】正式訂單需求運算循序", "【場景 3】滾動預測 PIR 與 LTP 模擬循序"]},
        {"code": "MD04P", "name": "Fashion 尺碼庫存需求清單", "category": "需求規劃", "role": "生管 / 資材", "desc": "依九宮格尺碼展開查看鞋業變體料號之庫存需求狀況與缺口。", "scenarios": ["【場景 2】正式訂單需求運算循序", "【場景 3】滾動預測 PIR 與 LTP 模擬循序"]},
        {"code": "MD61", "name": "建立獨立預測需求 (PIR)", "category": "需求規劃", "role": "生管 (PP)", "desc": "手動建立月/週滾動預測用量 (PIR)，不產生正式工單。", "scenarios": ["【場景 3】滾動預測 PIR 與 LTP 模擬循序"]},
        {"code": "MD62", "name": "修改獨立預測需求 (PIR)", "category": "需求規劃", "role": "生管 (PP)", "desc": "調整已存在之預測需求月份、週別與數量。", "scenarios": ["【場景 3】滾動預測 PIR 與 LTP 模擬循序"]},
        {"code": "MD63", "name": "顯示獨立預測需求 (PIR)", "category": "需求規劃", "role": "生管 (PP)", "desc": "檢視特定型體之歷史預測值與版本消耗狀態。", "scenarios": ["【場景 3】滾動預測 PIR 與 LTP 模擬循序"]},
        {"code": "ZPP006", "name": "Excel 批次上傳 PIR 需求", "category": "需求規劃", "role": "生管 (PP)", "desc": "依品牌客戶提供之 Excel 預測表批次匯入多型體 PIR 需求。", "scenarios": ["【場景 3】滾動預測 PIR 與 LTP 模擬循序"]},
        {"code": "MS31", "name": "建立長期規劃 (LTP) 模擬情境", "category": "需求規劃", "role": "生管 (PP)", "desc": "建立隔離之長期規劃情境 (Scenario)，綁定預測版本。", "scenarios": ["【場景 3】滾動預測 PIR 與 LTP 模擬循序"]},
        {"code": "MS32", "name": "修改長期規劃 (LTP) 模擬情境", "category": "需求規劃", "role": "生管 (PP)", "desc": "變更 LTP 情境參數、放行狀態或有效區間。", "scenarios": ["【場景 3】滾動預測 PIR 與 LTP 模擬循序"]},
        {"code": "MS01", "name": "長期規劃 (LTP) 模擬 MRP", "category": "需求規劃", "role": "生管 (PP)", "desc": "針對預測 PIR 方案執行模擬 MRP，絕不污染正式工單與庫存帳。", "scenarios": ["【場景 3】滾動預測 PIR 與 LTP 模擬循序"]},
        {"code": "MSBT", "name": "長期規劃 (LTP) 背景批次 MRP", "category": "需求規劃", "role": "生管 (PP)", "desc": "夜間批次大批量執行 LTP 模擬運算，產出長交期材料需求。", "scenarios": ["【場景 3】滾動預測 PIR 與 LTP 模擬循序"]},
        {"code": "ZPPQ02", "name": "LTP 模擬 MRP 展開結果明細表", "category": "需求規劃", "role": "生管 / 資材", "desc": "鞋業客製 LTP 模擬結果展開表，依鞋型/尺碼統計模擬毛需求。", "scenarios": ["【場景 3】滾動預測 PIR 與 LTP 模擬循序"]},
        {"code": "MS04", "name": "長期規劃 (LTP) 模擬庫存需求清單", "category": "需求規劃", "role": "生管 (PP)", "desc": "檢視特定物料在 LTP 情境下之模擬供給與模擬計畫單。", "scenarios": ["【場景 3】滾動預測 PIR 與 LTP 模擬循序"]},
        {"code": "ZPP914", "name": "預測 vs 實績用量消耗對比報表", "category": "需求規劃", "role": "生管 / 業務", "desc": "查核 PIR 預測數量與正式接單 SO 實績消耗比例與差異。", "scenarios": ["【場景 3】滾動預測 PIR 與 LTP 模擬循序"]},
        {"code": "FSH_PCW", "name": "Fashion 生產工作台", "category": "工單與排程", "role": "生管 (PP)", "desc": "鞋業核心工作台：計畫單轉量產工單、報工、批次 TECO 結案。", "scenarios": ["【場景 4】工單轉開與釋放循序", "【場景 9】現場報工與完工入庫循序", "【場景 11】月結 TECO 與財務結案循序"]},
        {"code": "ZPP015", "name": "批次 Excel 上傳開工單", "category": "工單與排程", "role": "生管 (PP)", "desc": "依銷售訂單批次開立量產工單 (ZP02)，自動拆單檢核尺碼。", "scenarios": ["【場景 4】工單轉開與釋放循序"]},
        {"code": "CO01", "name": "手動建立生產訂單", "category": "工單與排程", "role": "生管 (PP)", "desc": "標準 SAP 手動開單，用於重工或特殊研發單開立。", "scenarios": ["【場景 4】工單轉開與釋放循序"]},
        {"code": "CO02", "name": "修改生產訂單", "category": "工單維護", "role": "生管 (PP)", "desc": "單張工單維護、下達 TECO、調整卸貨點或暫時撤銷 TECO。", "scenarios": ["【場景 4】工單轉開與釋放循序", "【場景 8】委外加工發包與收貨循序", "【場景 11】月結 TECO 與財務結案循序", "【場景 13】業務訂單挪單因應處置循序"]},
        {"code": "CO03", "name": "顯示生產訂單", "category": "工單維護", "role": "生管 / 現場", "desc": "檢視工單表頭、作業、元件、結算規則與成本概況。", "scenarios": ["【場景 11】月結 TECO 與財務結案循序"]},
        {"code": "CO07", "name": "建立無物料生產訂單 (包裝/重工)", "category": "工單與排程", "role": "生管 (PP)", "desc": "建立無物料表頭之包裝工單 (ZP04)，不展階，成本直接進重工科目 51110099。", "scenarios": ["【場景 12】包裝工單與 VAS 客製加值循序"]},
        {"code": "CO13", "name": "取消生產訂單確認", "category": "完工報工", "role": "生管 / 現場", "desc": "沖銷誤報工或重複報工，系統反向執行 262 與 102 沖帳。", "scenarios": ["【場景 10】報工撤銷與回沖重報循序"]},
        {"code": "ZPP014A", "name": "工單資料拋轉 APS 排程", "category": "工單與排程", "role": "生管 (PP)", "desc": "將 SAP 工單工序拋至 APS 高級排程系統進行產能排程。", "scenarios": ["【場景 4】工單轉開與釋放循序"]},
        {"code": "ZPP014B", "name": "APS 排程結果回傳寫入 SAP", "category": "工單與排程", "role": "生管 (PP)", "desc": "接收 APS 計算後之工單開始/完工日期並回寫 AFKO/AFPO。", "scenarios": ["【場景 4】工單轉開與釋放循序"]},
        {"code": "ZPP016", "name": "工單批次建立中介暫存與校驗", "category": "工單與排程", "role": "生管 / IT", "desc": "鞋業工單批次建立之中介暫存表校驗與重拋作業。", "scenarios": ["【場景 4】工單轉開與釋放循序"]},
        {"code": "ZPP019", "name": "工單釋放與列印派工單", "category": "工單與排程", "role": "生管 (PP)", "desc": "工單狀態由 CRTD 轉為 REL，自動產出委外 PR 並列印派工單。", "scenarios": ["【場景 4】工單轉開與釋放循序", "【場景 8】委外加工發包與收貨循序"]},
        {"code": "ZPP020", "name": "分批領料單開立與維護", "category": "領料發料", "role": "生管 (PP)", "desc": "依成型日與首投製程建立領料單；刪單需依 SO 整張刪除。", "scenarios": ["【場景 5】現場領料單開立與檢貨循序", "【場景 6】現場退料與 ECN 抽換元件循序", "【場景 7】現場不良報廢開立補料單循序", "【場景 12】包裝工單與 VAS 客製加值循序", "【場景 13】業務訂單挪單因應處置循序"]},
        {"code": "ZPP021", "name": "列印領料條碼單", "category": "領料發料", "role": "生管 (PP)", "desc": "列印條碼單交由倉庫進行檢貨備料與掃描扣帳。", "scenarios": ["【場景 5】現場領料單開立與檢貨循序"]},
        {"code": "MIGO", "name": "物料文件收發貨作業", "category": "領料發料", "role": "倉管 (MM)", "desc": "SAP 標準收發貨：Mvt 261 發料、Mvt 101 收貨、Mvt 262 退料、Mvt 311 移轉。", "scenarios": ["【場景 5】現場領料單開立與檢貨循序", "【場景 6】現場退料與 ECN 抽換元件循序", "【場景 8】委外加工發包與收貨循序", "【場景 9】現場報工與完工入庫循序", "【場景 13】業務訂單挪單因應處置循序"]},
        {"code": "ZPP024", "name": "現場退料單維護", "category": "退料補料", "role": "生管 (PP)", "desc": "生管針對 ECN 改單或多領材料開立退料單。", "scenarios": ["【場景 6】現場退料與 ECN 抽換元件循序", "【場景 13】業務訂單挪單因應處置循序"]},
        {"code": "ZPP010", "name": "ECN 調整工單元件", "category": "退料補料", "role": "生管 (PP)", "desc": "鞋業專用改單程式，抽換元件並自動帶出首投製程 (禁入 CO02)。", "scenarios": ["【場景 6】現場退料與 ECN 抽換元件循序", "【場景 13】業務訂單挪單因應處置循序"]},
        {"code": "ZPP022", "name": "超耗補料工單開立 (ZP03/ZP05)", "category": "退料補料", "role": "生管 (PP)", "desc": "開立獨立補料工單，成本分開歸集核算，不污染量產正單。", "scenarios": ["【場景 7】現場不良報廢開立補料單循序"]},
        {"code": "ZPP017A", "name": "MES 報工數據回傳 SAP", "category": "完工報工", "role": "現場 / MES", "desc": "產線刷條碼，定時由背景回傳 SAP 倒扣料 (261) 與報工工時。", "scenarios": ["【場景 9】現場報工與完工入庫循序", "【場景 10】報工撤銷與回沖重報循序"]},
        {"code": "ZPP017B", "name": "MES 報工回傳錯誤日誌排查", "category": "完工報工", "role": "生管 / IT", "desc": "查核 MES 拋轉失敗記錄 (ZPPL017) 並執行手動重新拋轉。", "scenarios": ["【場景 9】現場報工與完工入庫循序", "【場景 10】報工撤銷與回沖重報循序"]},
        {"code": "CO11N", "name": "生產訂單單一作業確認", "category": "完工報工", "role": "現場 / 生管", "desc": "手動輸入工單作業良品量、報廢量與報工工時。", "scenarios": ["【場景 9】現場報工與完工入庫循序"]},
        {"code": "COGI", "name": "失敗的物料異動清理", "category": "清理月結", "role": "生管 / 資材", "desc": "處理報工倒扣失敗料件，補足庫存後儲存重新過帳歸零。", "scenarios": ["【場景 11】月結 TECO 與財務結案循序"]},
        {"code": "COOIS", "name": "生產訂單資訊系統", "category": "清理月結", "role": "生管 / 資材 / 稽核", "desc": "工單全方位稽核：元件領料數量、報工確認、委外 PR、資材分析表。", "scenarios": ["【場景 2】正式訂單需求運算循序", "【場景 5】現場領料單開立與檢貨循序", "【場景 6】現場退料與 ECN 抽換元件循序", "【場景 9】現場報工與完工入庫循序", "【場景 10】報工撤銷與回沖重報循序", "【場景 11】月結 TECO 與財務結案循序", "【場景 13】業務訂單挪單因應處置循序"]},
        {"code": "ZPP042", "name": "採購單需求追蹤號碼寫入", "category": "需求規劃", "role": "生管 (PP)", "desc": "為 MTS 原料/底半品回填採購單追蹤號 (EKPO-BEDNR) 溯源 SO。", "scenarios": ["【場景 2】正式訂單需求運算循序"]},
        {"code": "ZPPQ42", "name": "需求追蹤號碼查詢報表", "category": "需求規劃", "role": "生管 / 資材", "desc": "即時查驗採購單與銷售訂單關聯綁定狀況與未綁清單。", "scenarios": ["【場景 2】正式訂單需求運算循序"]},
        {"code": "ZPP031", "name": "工單缺料分析報表", "category": "工單與排程", "role": "生管 / 資材", "desc": "依開工日動態分析工單所需材料之齊套率與缺料項次。", "scenarios": ["【場景 4】工單轉開與釋放循序", "【場景 5】現場領料單開立與檢貨循序"]},
        {"code": "ZPP032", "name": "產能負荷與在製 WIP 分析", "category": "工單與排程", "role": "生管 (PP)", "desc": "分析工作中心產能負荷狀況與產線在製品 WIP 堆積。", "scenarios": ["【場景 4】工單轉開與釋放循序"]},
        {"code": "ZMM046", "name": "工單備料單檢貨備料 (鞋廠)", "category": "領料發料", "role": "倉管 (MM)", "desc": "倉庫掃碼領料單檢貨過帳，背景執行 Mvt 261 工單發料扣帳。", "scenarios": ["【場景 5】現場領料單開立與檢貨循序", "【場景 7】現場不良報廢開立補料單循序", "【場景 12】包裝工單與 VAS 客製加值循序"]},
        {"code": "ZMM046M", "name": "底半品備料單領料 (底廠)", "category": "領料發料", "role": "倉管 (MM)", "desc": "專供底廠粗胚/射出/組底工單之檢貨備料過帳。", "scenarios": ["【場景 5】現場領料單開立與檢貨循序"]},
        {"code": "ZMM047", "name": "MM 退料單過帳", "category": "退料補料", "role": "倉管 (MM)", "desc": "倉庫對應 ZPP024 退料單過帳點收，背景執行 Mvt 262 沖銷。", "scenarios": ["【場景 6】現場退料與 ECN 抽換元件循序", "【場景 13】業務訂單挪單因應處置循序"]},
        {"code": "ZPP110", "name": "現場成型進度看板", "category": "完工報工", "role": "現場生管", "desc": "鞋業現場成型線實時報工與達成率大螢幕看板。", "scenarios": ["【場景 9】現場報工與完工入庫循序"]},
        {"code": "ZSD012", "name": "批次銷售訂單建立與九宮格維護", "category": "業務主檔", "role": "業務 (SD)", "desc": "業務建立銷售訂單並配置鞋業九宮格 Size Run 矩陣。", "scenarios": ["【場景 2】正式訂單需求運算循序"]},
        {"code": "ZSD013", "name": "銷售訂單排程與出貨進度追蹤", "category": "業務主檔", "role": "業務 (SD)", "desc": "追蹤 SO 工廠排產與成品入庫交運狀態。", "scenarios": ["【場景 2】正式訂單需求運算循序"]},
        {"code": "ZMM091", "name": "倉庫儲位庫存與發料料架總覽", "category": "領料發料", "role": "倉管 (MM)", "desc": "倉庫料架儲位動態總覽，協助 ZMM046 揀料路徑規劃。", "scenarios": ["【場景 5】現場領料單開立與檢貨循序"]},
        {"code": "ZPPQ01", "name": "鞋型 BOM 與途程綜合查詢報表", "category": "基礎主檔", "role": "生管 / BOM組", "desc": "快速聯查特定鞋型之完整母階/子階 BOM、標準途程與生產版本狀態。", "scenarios": ["【場景 1】PP 基礎主檔建置標準循序"]},
        {"code": "VA03", "name": "顯示銷售訂單", "category": "業務查核", "role": "業務 / 生管", "desc": "檢視客戶訂單狀態、拒絕原因、九宮格尺碼分配與出貨交期。", "scenarios": ["【場景 2】正式訂單需求運算循序", "【場景 13】業務訂單挪單因應處置循序"]},
        {"code": "SE16N", "name": "一般資料表即時查核", "category": "後台底層", "role": "Key User / IT", "desc": "直接查詢 SAP 後台資料表 (AFKO, RESB, FSH_BOM_VD, ZMMT046 等) 底層狀態。", "scenarios": ["【全場景後台排查】"]},
        {"code": "ME27", "name": "建立外協發料 (出廠發料至供應商)", "category": "委外代工", "role": "倉管 (MM)", "desc": "依委外採購訂單將原材料發給外協代工廠，過帳 Mvt 541 (轉入供應商特殊庫存，無會計憑證)。", "scenarios": ["【場景 8】途程工序委外外協閉環循序 (PP02 / 541 / 543)"]},
        {"code": "ME21N", "name": "建立外協採購訂單 (PO)", "category": "採購作業", "role": "採購 (MM)", "desc": "將工單釋放產生的委外 PR (項目類別 L / 科目分配 F) 轉開為外協加工採購訂單 (POUR/POSS)。", "scenarios": ["【場景 8】途程工序委外外協閉環循序 (PP02 / 541 / 543)"]},
        {"code": "ME11", "name": "維護採購資訊記錄 (委外加工)", "category": "採購主檔", "role": "採購 (MM)", "desc": "維護外協供應商、工序代工費與交期，資訊類別固定選取「3 (委外加工)」，為 PP02 前置關鍵主檔。", "scenarios": ["【場景 1】PP 基礎主檔建置標準循序", "【場景 8】途程工序委外外協閉環循序 (PP02 / 541 / 543)"]},
        {"code": "ME2O", "name": "供應商外協庫存監控報表", "category": "庫存監控", "role": "資材 / 倉管", "desc": "監控各外協供應商名下之原材料特殊庫存 (SC Stock / Mvt 541) 結存與 543 耗用情況。", "scenarios": ["【場景 8】途程工序委外外協閉環循序 (PP02 / 541 / 543)"]}
    ],

    # 8. 情境導向 T-Code 循序流動圖 (Scenario-Driven Sequential Workflow Hub)
    "scenario_flows": [
        {
            "id": "scene_master_data",
            "title": "【場景 1】PP 基礎主檔建置標準循序",
            "category": "基礎主檔",
            "icon": "🏗️",
            "desc": "新鞋型或量產前夕，依照『部位 ➔ BOM九宮格 ➔ 工作中心 ➔ 標準途程 ➔ 生產版本』嚴格循序建立，杜絕前置日期脫鉤。",
            "steps": [
                {
                    "step_num": 1,
                    "tcode": "ZPP001",
                    "name": "品牌部位代碼與名稱維護",
                    "role": "BOM 組 / 生管",
                    "action": "依品牌代碼維護鞋面 (Upper)、鞋舌 (Tongue)、鞋帶 (Lace)、內裡 (Lining) 之裁斷部位代號，支援 Excel 批次上傳。",
                    "output": "部位代號維護完成，作為後續 CS01 自動帶出【首投製程 (STPO-ZZFIRST)】與領料單說明的觸發源。",
                    "caution": "若未維護部位代號，後續 BOM 將無法帶出首投製程，造成 ZPP020 領料單無法按工段拆單！"
                },
                {
                    "step_num": 2,
                    "tcode": "CS01 / ZPP002",
                    "name": "建立物料清單 (BOM) 與 Fashion 九宮格",
                    "role": "BOM 組",
                    "action": "建立母階 (GA) 與子階 (VA) BOM，填入部位排序字串帶出首投製程；維護九宮格 Size Run 數量分配檔與替代料群組 A1。",
                    "output": "Fashion 生產 BOM 建立完成，底層寫入 FSH_BOM_VD 資料表串聯尺碼矩陣。",
                    "caution": "維護九宮格後務必核對 GA 與 VA 用量一致，防止 FSH_BOM_VD.V_STLNR 為空脫鉤導致漏料！"
                },
                {
                    "step_num": 3,
                    "tcode": "CR01",
                    "name": "建立工作中心 (Work Center)",
                    "role": "工程部 / 生產部",
                    "action": "定義裁斷、針車、成型、貼合之實體線別工作中心，設定產能類別並正確指派對應之【成本中心】。",
                    "output": "工作中心建立完成，供 CA01 指派工序與計算人工/機台分攤費率。",
                    "caution": "外購品與委託代工廠不需要工作中心；工作中心成本中心未指派將導致工單無法結算。"
                },
                {
                    "step_num": 4,
                    "tcode": "CA01 / ZPP003",
                    "name": "建立標準途程 (Routing) 與控制碼配置",
                    "role": "工程部 / 生管",
                    "action": "依製程工序配置工作中心、設定控制碼 (PP01~PP08)，並維護直接人工 (AK) 與基礎數量 (AF) 標準作業工時。",
                    "output": "標準途程建立，狀態必須設定為【4: 已核發】並記錄正式生效起始日期 (Valid-From)。",
                    "caution": "整張工單只能有一站且必須在最後一站設定自動入庫控制碼 (PP03/PP08)！"
                },
                {
                    "step_num": 5,
                    "tcode": "C223 / ZC223",
                    "name": "維護生產版本 (Production Version) 四合一綁定",
                    "role": "生管 / BOM 組",
                    "action": "將物料、BOM 替代、途程群組與批量範圍進行四合一綁定；點擊『檢查』圖示確認狀態燈號。",
                    "output": "生產版本狀態亮綠燈 (🟢)，正式具備開立工單與 MRP 展開能力。",
                    "caution": "💥 鐵律防呆：生產版本有效開始日期必須【大於或等於途程生效日期】，否則轉工單時必噴錯阻擋！"
                }
            ]
        },
        {
            "id": "scene_mto_demand",
            "title": "【場景 2】正式訂單 (MTO大貨) 需求運算與採購溯源循序",
            "category": "需求規劃",
            "icon": "📈",
            "desc": "業務接獲客戶正式訂單後，自 SO 拋轉 ➔ MRP Live 運算 ➔ 查驗供需 ➔ 採購請購轉單 ➔ MTS 材料需求追蹤號溯源綁定之標準鏈條。",
            "steps": [
                {
                    "step_num": 1,
                    "tcode": "VA01 / ZSD012",
                    "name": "業務開立 / 自動拋轉銷售訂單 (SO)",
                    "role": "業務 (SD)",
                    "action": "接獲品牌客戶訂單，建立 6 開頭貿易公司 SO，背景排程 (ZMM091/ZSD013) 自動拋轉產出 C 開頭生產工廠訂單。",
                    "output": "產生 C 開頭工廠端正式銷售訂單，確認無拒絕原因 (如 Z3) 且具備正確尺碼用量。",
                    "caution": "生管日常只看 C 單；若有 6 單無 C 單，代表跨公司拋轉中斷，應立即通報 SD 負責人排查！"
                },
                {
                    "step_num": 2,
                    "tcode": "MD01N",
                    "name": "執行 MRP Live 正式訂單運算",
                    "role": "生管 (PP)",
                    "action": "依工廠與物料代碼執行 MRP Live (MD01N)，系統依銷售訂單交期自動展 BOM 並計算淨需求。",
                    "output": "產出正式主檔計畫單 (Planned Order) 與外購原材料採購請購單 (PR)。",
                    "caution": "正式訂單 MTO 絕對跑 MD01N，絕不可跑 MS01 (那是預測模擬 MRP 專用)！"
                },
                {
                    "step_num": 3,
                    "tcode": "MD04 / MD04P",
                    "name": "動態查核庫存需求清單與九宮格平衡",
                    "role": "生管 / 資材",
                    "action": "進入 MD04 / MD04P 查核各尺碼之供需平衡表，核對計畫單交期與外購料件 PR 產出狀況。",
                    "output": "確認各站半成品計畫單與下階原物料 PR 皆完整展出，無缺口異常。",
                    "caution": "若計畫單未跑出，立即循【第 2.7 節六步排查樹】檢查 SO 取消狀態、BOM 生效日與生產版本綠燈。"
                },
                {
                    "step_num": 4,
                    "tcode": "ME57 / ME21N",
                    "name": "請購單 (PR) 指派供應商轉採購單 (PO)",
                    "role": "採購 (MM)",
                    "action": "採購人員將 MRP 產出之材料請購單，依核價記錄 (ME11) 分派給配合供應商，開立採購訂單 (PO)。",
                    "output": "產生採購單號 (PO)，採購單進入審批發送流程。",
                    "caution": "MTS 備庫料件在 SAP 原生邏輯下採購單不會帶入 SO，導致資材無法得知是為哪張訂單備料。"
                },
                {
                    "step_num": 5,
                    "tcode": "ZPP042",
                    "name": "執行採購單需求追蹤號碼綁定",
                    "role": "生管 (PP)",
                    "action": "針對通用底半品、EVA、共用五金飾扣等 MTS 材料，執行 ZPP042 批次將前端銷售訂單號回填至 EKPO-BEDNR。",
                    "output": "成功將 SO 追蹤號寫入採購單項目 (EKPO-BEDNR)，建立 MTS 物料與客戶訂單之溯源鏈條。",
                    "caution": "只有 MTS 行為材料需執行 ZPP042！純 MTO 原生已帶 SO，純 PIR 尚未有正式接單則略過。"
                },
                {
                    "step_num": 6,
                    "tcode": "ZPPQ42 / COOIS",
                    "name": "資材分析表追蹤關聯查驗",
                    "role": "生管 / 資材",
                    "action": "進入 COOIS 選擇清單『/PP-003 資材分析表』，輸入 SO 號查詢採購文件欄位是否成功帶出 MTS 採購單。",
                    "output": "確認資材分析表顯示 MTS 採購單號，備料溯源大功告成！",
                    "caution": "若欄位為空白，檢查物料主檔 ZMMT059_3 是否為 MTS，以及參數表 ZPP042_2 是否啟用工廠設定。"
                }
            ]
        },
        {
            "id": "scene_pir_ltp",
            "title": "【場景 3】滾動預測 (PIR) 與長期規劃 LTP 模擬運算循序",
            "category": "需求規劃",
            "icon": "🔮",
            "desc": "依品牌客戶提供之 3~6 個月滾動 Forecast，執行長期規劃模擬運算，專供長交期備料與 B2B 拋轉，100% 隔離不污染正式庫存與工單。",
            "steps": [
                {
                    "step_num": 1,
                    "tcode": "MD61 / ZPP006",
                    "name": "計劃獨立需求 (PIR) 手動維護 / Excel 批次上傳",
                    "role": "生管 (PP)",
                    "action": "手動至 MD61 建立月/週滾動預測用量；或使用鞋業專用程式 ZPP006 批次由 Excel 匯入各型體 PIR。",
                    "output": "PIR 預測需求寫入系統，指定規劃期間與型體尺碼配置。",
                    "caution": "預測需求絕不可直接執行 MD01N，否則會產出假性正式採購單造成工廠鉅額溢買！"
                },
                {
                    "step_num": 2,
                    "tcode": "MS31 / MS32",
                    "name": "建立長期規劃方案 (LTP Planning Scenario)",
                    "role": "生管 (PP)",
                    "action": "進入 MS31 建立長期規劃方案代號，指定關聯之 PIR 版本，並勾選『排除正式現有庫存』與『使用模擬計畫單』。",
                    "output": "LTP 方案設定完成，建立完全隔離的模擬沙盒環境。",
                    "caution": "必須確認已按『釋放』按鈕啟用方案，未釋放之方案執行 MS01 將無任何反應。"
                },
                {
                    "step_num": 3,
                    "tcode": "MS01 / MSBT",
                    "name": "執行長期規劃模擬 MRP 運算",
                    "role": "生管 (PP)",
                    "action": "線上小批次執行 MS01，或設定夜間背景批次作業 MSBT 進行大批次 LTP 模擬運算。",
                    "output": "產出純模擬性質之計畫單 (Simulative Planned Orders)，系統標籤帶入方案代號。",
                    "caution": "模擬單據僅存在於記憶體與 LTP 報表中，絕不會在正式 MD04 顯示，亦無法轉為正式工單。"
                },
                {
                    "step_num": 4,
                    "tcode": "ZPPQ02 / MS04",
                    "name": "預測原料需求量查詢與查驗",
                    "role": "生管 (PP)",
                    "action": "執行鞋業專用預測查詢程式 ZPPQ02，輸入方案代碼，展開查詢各原料供應商未來月份預估需求量。",
                    "output": "產出長交期原料（如皮料、特殊飾扣、大底）之匯總需求清單。",
                    "caution": "產出報表需手動或自動刪除採購價格等敏感商業欄位，方可提供外部使用。"
                },
                {
                    "step_num": 5,
                    "tcode": "ZPP914",
                    "name": "拋轉供應商 B2B 備料平台",
                    "role": "生管 / 採購",
                    "action": "透過 ZPP914 將預測物料需求自動拋轉至供應商協同平台 (B2B Portal)，供廠商預排產能與備胚料。",
                    "output": "供應商提前掌握備料節奏，實現雙軌制之長交期預備，完成閉環！",
                    "caution": "後續業務若轉入正式 SO，需提醒業務追蹤預告訂單拒絕原因 (Z3)，避免需求重複疊加。"
                }
            ]
        },
        {
            "id": "scene_wo_release",
            "title": "【場景 4】排程與開立量產工單循序 (轉單 ➔ 排程 ➔ 釋放 ➔ 列印)",
            "category": "工單與排程",
            "icon": "📋",
            "desc": "由正式計畫單轉換為量產工單 ZP02，串聯 APS 高級排程系統，完成工單釋放 REL 與實體條碼派工單列印。",
            "steps": [
                {
                    "step_num": 1,
                    "tcode": "FSH_PCW / ZPP015",
                    "name": "計畫單轉量產工單 (ZP02)",
                    "role": "生管 (PP)",
                    "action": "在 FSH_PCW 生產工作台選定主檔計畫單轉為量產工單 (ZP02)；或使用 ZPP015 依 Excel 批次上傳轉工單。",
                    "output": "產生正式量產工單 (ZP02)，狀態為 CRTD (已建立)，自動產生各工序物料預留單 (RESB)。",
                    "caution": "工單表頭之『利潤中心』與『卸貨點 SO 號碼』為必填！漏填將導致後續發料與月結報錯。"
                },
                {
                    "step_num": 2,
                    "tcode": "ZPP014A",
                    "name": "工單資料拋轉 APS 排程系統",
                    "role": "生管 (PP)",
                    "action": "執行 ZPP014A，選取已建立之工單，將產線工序、標準工時與限制條件自動拋轉至 APS 高級排程伺服器。",
                    "output": "中介表 ZPPL016_H / ZPPL016_R 寫入拋轉資料，APS 接收進行機台產能優化排程。",
                    "caution": "若途程無維護工作中心或工時為 0，APS 排程將無法計算天數並拋回錯誤代碼。"
                },
                {
                    "step_num": 3,
                    "tcode": "ZPP014B",
                    "name": "APS 排程工期結果回傳 SAP",
                    "role": "生管 (PP)",
                    "action": "APS 排定最佳生產線別與日期後，系統透過 ZPP014B 定時回寫 SAP 工單開工日、完工日與成型日。",
                    "output": "SAP 工單之排程日期與成型日 (ZZSHDATE) 精確更新，作為後續領料單拆單基準。",
                    "caution": "生管應核對成型日期是否合理，成型日為 ZPP020 拆分領料單之核心樞紐欄位。"
                },
                {
                    "step_num": 4,
                    "tcode": "ZPP019",
                    "name": "工單釋放 (Release) 與條碼派工單列印",
                    "role": "生管 (PP)",
                    "action": "在 ZPP019 (或 FSH_PCW) 批次執行工單釋放 (REL)，並列印附帶工單條碼之車間實體派工單交產線。",
                    "output": "工單狀態由 CRTD 轉為 REL (已釋放)；若有委外工序 (PP02)，系統背景自動開立委外請購單 (PR)。",
                    "caution": "未打 REL 狀態之工單嚴禁現場開工，倉庫亦無法進行任何發料過帳！"
                }
            ]
        },
        {
            "id": "scene_gi_pick",
            "title": "【場景 5】現場領料與倉庫備料發料閉環循序",
            "category": "領料發料",
            "icon": "🚚",
            "desc": "生管依成型日與首投製程拆單開立領料單 ➔ 列印條碼 ➔ 倉庫掃碼備料 ➔ BAPI 自動過帳 Mvt 261 扣帳並查驗實領量之標準閉環。",
            "steps": [
                {
                    "step_num": 1,
                    "tcode": "ZPP020",
                    "name": "開立分批領料單 (按首投製程拆單)",
                    "role": "生管 (PP)",
                    "action": "輸入成型日區間與銷售訂單號，勾選『僅預覽』確認材料無誤後，取消打勾執行儲存，正式產出領料單號。",
                    "output": "系統依『銷售訂單 + 主檔工單 + 首投製程 + 儲存地點』精確拆單產出各工段實體領料單號。",
                    "caution": "若需作廢領料單，必須【依銷售訂單號整張查詢刪除】！切勿按單一工單刪除造成項次殘留。"
                },
                {
                    "step_num": 2,
                    "tcode": "ZPP021",
                    "name": "列印附帶條碼領料單交由倉庫",
                    "role": "生管 (PP)",
                    "action": "執行 ZPP021，輸入領料單號列印紙本單據，單據包含料號、批次、儲位條碼與部位說明交由倉庫備料組。",
                    "output": "實體領料條碼單列印完成，倉管憑單進行揀貨。",
                    "caution": "核對領料單上部位名稱是否正確，若部位空白代表 BOM 未維護排序字串。"
                },
                {
                    "step_num": 3,
                    "tcode": "ZMM046 / ZMM046M",
                    "name": "倉庫條碼掃描檢貨備料與發料過帳 (Mvt 261)",
                    "role": "倉管 (MM)",
                    "action": "鞋廠操作 ZMM046、底廠操作 ZMM046M，手持 PDA 掃描領料單條碼進行實體揀貨，確認無誤後點擊過帳。",
                    "output": "系統背景呼叫 BAPI 執行異動類型 261 (對工單發料)，扣減原物料庫存並產生物料文件。",
                    "caution": "若物料為 QM 列管品且未經 UD 放行，系統將直接跳出 E023 阻擋，嚴禁發出未檢合格料！"
                },
                {
                    "step_num": 4,
                    "tcode": "COOIS",
                    "name": "即時查驗工單元件領料數量 (Withdrawn Qty)",
                    "role": "生管 (PP)",
                    "action": "生管進入 COOIS (清單選『元件』)，核對該工單各料件之『領料數量 (RESB-ENMNG)』是否等於需求數量。",
                    "output": "確認所有材料領料數量皆已到位，產線料件備齊，完成領料發料閉環！",
                    "caution": "若倉庫備料單狀態為 I 或 M，Table ZMMT046 將鎖定領料單禁止生管刪單改單。"
                }
            ]
        },
        {
            "id": "scene_return_ecn",
            "title": "【場景 6】現場退料、元件 ECN 變更抽換與重開領料單循序 (解鎖 E005)",
            "category": "退料與ECN",
            "icon": "🔄",
            "desc": "工單已發料後遇工程變更 (ECN) 或更換材料時，透過『262退料歸零 ➔ ECN改單 ➔ 重新拆單』解除 E005 阻擋之標準三步閉環。",
            "steps": [
                {
                    "step_num": 1,
                    "tcode": "COOIS",
                    "name": "查核欲抽換元件之實際領料數量",
                    "role": "生管 (PP)",
                    "action": "進 COOIS (元件清單)，確認欲變更料號之『領料數量 (RESB-ENMNG)』。若 > 0 則確認處於 E005 鎖定模式。",
                    "output": "查得工單號、欲更換料號、原發料儲位與已領數量，供退料單精確輸入。",
                    "caution": "若實領數 > 0，嚴禁直接在工單按刪除或進 CO02 修改！"
                },
                {
                    "step_num": 2,
                    "tcode": "ZPP024",
                    "name": "開立現場退料單 (指定工單與首投製程)",
                    "role": "生管 (PP)",
                    "action": "生管進入 ZPP024，選擇原量產工單號與【原首投製程】，輸入欲退回之材料與數量，儲存並列印退料單。",
                    "output": "產生正式退料單號，交由產線將實體材料送回倉庫點收。",
                    "caution": "嚴禁跨工單混退料！退料必須嚴格依照原工單與原首投製程，避免月結產生重工借貸尾差。"
                },
                {
                    "step_num": 3,
                    "tcode": "ZMM047 / MIGO 262",
                    "name": "倉庫點收實物並過帳沖銷 (Mvt 262)",
                    "role": "倉管 (MM)",
                    "action": "倉庫人員進入專用程式 ZMM047 輸入退料單號，清點實物無誤後過帳，系統背景執行 Mvt 262 (發料沖銷)。",
                    "output": "原物料庫存即刻回沖儲位，工單 RESB-ENMNG 實領數量扣減沖銷至 0！",
                    "caution": "若過帳報錯，檢查該工單是否已被打上 TECO；若已 TECO 需先至 CO02 暫時撤銷 TECO。"
                },
                {
                    "step_num": 4,
                    "tcode": "CC01 / CC02",
                    "name": "建立 / 發起 ECN 工程更改號碼 (Change Master)",
                    "role": "工程部",
                    "action": "進入 CC01 建立 ECN 更改號碼，設定生效起始日期，並在物件類型將【物料表 (BOM)】與【途程】打勾啟用。",
                    "output": "產生合法 ECN 更改號 (存於 Table AENR)，作為後續改單之版次依據。",
                    "caution": "現場常問 ECN 哪裡生，此步為工程部專屬動作，生管需取得有效 ECN 號碼方可改單。"
                },
                {
                    "step_num": 5,
                    "tcode": "ZPP010",
                    "name": "執行 ECN 工單元件抽換調整 (解除 E005)",
                    "role": "生管 (PP)",
                    "action": "實領數歸零後進入鞋業專用改單程式 ZPP010，帶入 ECN 號碼，刪除舊料並新增新材料。",
                    "output": "元件更換完成，系統自動匹配部位代碼並帶出新料之首投製程代碼 (STPO-ZZFIRST)！",
                    "caution": "💥 第一大忌：切勿進 CO02 改料！CO02 修改無 BOM 關聯，ZPP020 將無法拆單發料！"
                },
                {
                    "step_num": 6,
                    "tcode": "ZPP020",
                    "name": "重新預覽並開立新元件領料單",
                    "role": "生管 (PP)",
                    "action": "改單完成後，生管重新進 ZPP020，依新成型日與首投製程開立領料單，下發倉庫再次發料。",
                    "output": "新元件領料單開立完成，完全閉環！",
                    "caution": "領料單開立後，若需替換為替代料，使用專用程式 ZPP032 批次處理。"
                }
            ]
        },
        {
            "id": "scene_scrap_order",
            "title": "【場景 7】現場超耗與損耗補料工單開立循序 (ZP03)",
            "category": "退料與ECN",
            "icon": "🧩",
            "desc": "現場因人為不良、材料重大瑕疵超耗時，開立獨立補料工單 ZP03，獨立歸集超耗成本，絕不污染原大貨正單成本之標準程序。",
            "steps": [
                {
                    "step_num": 1,
                    "tcode": "ZPP022",
                    "name": "開立超耗單補料工單 (ZP03)",
                    "role": "現場組長 / 生管",
                    "action": "進入 ZPP022，輸入原量產正單號碼 (ZP02) 與本次超耗補料之雙數/數量，系統自動開立 ZP03 工單。",
                    "output": "產生 ZP03 超耗補料工單，自動繼承原正單之物料與途程結構，成本結算規則自動帶出。",
                    "caution": "⚠️ 鐵律：正單未完成入庫前的個別補料用 ZP03！若正單已完工入庫成套補做，必須開 ZP05！"
                },
                {
                    "step_num": 2,
                    "tcode": "ZPP023",
                    "name": "列印補料單與跨部門審批簽核",
                    "role": "生管 (PP)",
                    "action": "執行 ZPP023 列印紙本補料工單，經車間主任、品管與生管主管簽核確認損耗原因 (人為不良 vs 材料瑕疵)。",
                    "output": "紙本補料單完成主管簽核審批。",
                    "caution": "補料單需明確標註責任歸屬，以利財務月結進行超耗異常損益分析。"
                },
                {
                    "step_num": 3,
                    "tcode": "ZPP020",
                    "name": "開立補料工單之領料單",
                    "role": "生管 (PP)",
                    "action": "生管至 ZPP020，單據類別選擇『補料工單 (ZP03 / ZP05)』，輸入補料工單號開立分批領料單。",
                    "output": "產生補料專用領料單，並透過 ZPP021 列印條碼單。",
                    "caution": "補料單類別與正單類別隔離，防止倉庫發料混帳。"
                },
                {
                    "step_num": 4,
                    "tcode": "ZMM046 / MIGO 261",
                    "name": "倉庫檢貨發料至線邊",
                    "role": "倉管 (MM)",
                    "action": "倉管掃描補料單條碼完成發料過帳 (Mvt 261)，材料送回產線補料。",
                    "output": "發料過帳完成，ZP03 不走 MES 報工與入庫，直接領料消耗回線邊，閉環完成！",
                    "caution": "ZP03 不入庫 (🔴 X)，發料成本直接歸集於該工單結算。"
                }
            ]
        },
        {
            "id": "scene_subcontract",
            "title": "【場景 8】途程工序委外代工 (PP02 / 541 / 543) 完整閉環循序",
            "category": "工單與排程",
            "icon": "🤝",
            "desc": "途程特定工序（如鞋面高週波、電繡、特殊印花）委外加工：ME11 委外資訊記錄 ➔ 工單釋放 REL 自動產生委外 PR ➔ ME21N 轉採購單 PO ➔ ME27 / MIGO 541 出廠外發料 ➔ MIGO 101 收貨自動觸發 543 倒扣原料與工序自動報工 (CNF) ➔ ME2O / COOIS 稽核全閉環。",
            "steps": [
                {
                    "step_num": 1,
                    "tcode": "CA01 / CA02 / ME11",
                    "name": "途程工序設定 PP02 與維護委外採購資訊記錄",
                    "role": "工程部 (IE) + 採購 (MM)",
                    "action": "在標準途程將特定工序控制碼設為 PP02（外部處理填『+』）。採購同步至 ME11 維護採購資訊記錄（資訊類別固定選『3 委外加工』），填入外協廠商、工序加工單價、稅碼與計畫交貨天數。",
                    "output": "途程具備外發委外屬性，該站廠內不設產能報工，後台關聯採購計價參數完成。",
                    "caution": "🚨 若未在 ME11 建立類別 3 委外資訊記錄，後續工單釋放時將報錯阻擋 (E_SUB_NO_ME11)！"
                },
                {
                    "step_num": 2,
                    "tcode": "ZPP019 / CO02 / ME21N",
                    "name": "工單下發釋放 (REL) 自動產出委外 PR 並轉開 PO",
                    "role": "生管 (PP) + 採購 (MM)",
                    "action": "生管下達工單釋放 (REL) 指令，系統自動為 PP02 工序產出委外採購申請（PR，項目類別 L / 科目分配 F）。採購人員隨後於 ME21N / ME57 將該 PR 轉立外協採購單 (PO，單據類型 POUR/POSS)。",
                    "output": "產出外協加工採購單 (PO)，明細自動帶出該工序應提供之外包原物料元件清單。",
                    "caution": "只有工單打 REL 才會觸發產生委外 PR；若工單仍在 CRTD 狀態，採購無法提早下 PO。"
                },
                {
                    "step_num": 3,
                    "tcode": "ME27 / MIGO 541",
                    "name": "倉庫外發原物料出廠至外協廠商 (轉移至外協庫存)",
                    "role": "倉管 (MM)",
                    "action": "倉管人員至 ME27 (建立外協發料) 或 MIGO 選擇『A08 移轉過帳 ➔ R08 生產訂單』，輸入外協 PO，執行 Mvt 541 將廠內原材料/半成品移轉至供應商特殊庫存 (Stock with Subcontractor)。",
                    "output": "過帳完成產生物料憑證。物料實體送交外協廠加工，SAP 帳面產權仍屬本公司，移至供應商特殊庫存 (無會計分錄)。",
                    "caution": "⚠️ 必須落實 541 出廠過帳！若未過帳，後續收貨時供應商在庫為 0，將引發 E_SUB_541_LACK 倒扣失敗阻擋！"
                },
                {
                    "step_num": 4,
                    "tcode": "MIGO 101",
                    "name": "外協加工品送回驗收入庫 (雙重自動連動)",
                    "role": "倉管 (MM) + 品管 (QM)",
                    "action": "外協廠加工完成送回廠內，倉管至 MIGO 選擇『A01 收貨 ➔ R01 採購單』輸入外協 PO 執行 101 收貨過帳。",
                    "output": "【雙重自動連動】：1. 系統自動在背景觸發【Mvt 543】扣減供應商處之原物料特殊庫存；2. 系統自動將生產工單該站 PP02 工序標記為【已完工確認 (CNF)】！",
                    "caution": "💡 廠內現場生管完全無需進入 CO11N 手動報工！若控制碼為 PP06，還會一併補報前置各站。"
                },
                {
                    "step_num": 5,
                    "tcode": "ME2O / COOIS",
                    "name": "供應商外協庫存結存監控與工單工序稽核",
                    "role": "資材 / 生管 (PP)",
                    "action": "生管與資材至 ME2O 監控外協廠商名下之原物料結存是否歸零或有剩餘；至 COOIS 查核工序確認清單，確認 PP02 狀態已轉為 CNF 且採購訂單已完全交付。",
                    "output": "外協帳實核銷完畢，生產工單無縫流轉至下一道廠內工序 (如針車/成型)。",
                    "caution": "若委外品有不良報廢，外協廠送回次品時需依合約辦理補料或於 PO 扣款處理。"
                }
            ]
        },
        {
            "id": "scene_confirmation_gr",
            "title": "【場景 9】完工報工與產成品入庫循序",
            "category": "完工報工",
            "icon": "⏱️",
            "desc": "現場產能刷卡報工 ➔ 自動倒扣原料與工時 ➔ 途程末站 PP03 自動觸發 Mvt 101 成品收貨入庫之核心量產閉環。",
            "steps": [
                {
                    "step_num": 1,
                    "tcode": "ZPP017A / FSH_PCW / CO11N",
                    "name": "現場完工報工數據錄入 / MES 自動回傳",
                    "role": "產線現場 / 生管",
                    "action": "有 MES 廠區現場刷條碼定時透過 ZPP017A 回傳；無 MES 廠區進 FSH_PCW 或 CO11N 手動錄入良品與報廢量。",
                    "output": "工單確認號產生，系統自動倒扣線邊原物料庫存，並記入作業工時與在製品計數。",
                    "caution": "若線邊庫存不足或儲位被鎖，將導致倒扣失敗產生 COGI 孤兒記錄，月結前必須清空！"
                },
                {
                    "step_num": 2,
                    "tcode": "PP03自動 / MIGO 101手動",
                    "name": "產成品收貨入庫過帳 (Mvt 101)",
                    "role": "系統自動 / 倉管",
                    "action": "若途程末站為 PP03 / PP08，報工過帳瞬間背景自動生成 101 成品入庫物料文件；若末站為 PP01 則由倉管手動至 MIGO 過帳 101。",
                    "output": "產成品庫存正式入庫至成品倉庫位，物料憑證產生。",
                    "caution": "💥 鐵律：整張工單只能有一站放 PP03 且必須在最後一站，否則自動入庫將完全失效！"
                },
                {
                    "step_num": 3,
                    "tcode": "COOIS",
                    "name": "查驗工單交付數量與完工狀態",
                    "role": "生管 (PP)",
                    "action": "生管進入 COOIS (清單選『訂單標頭』)，核對工單數量與實際『交付數量』是否一致。",
                    "output": "工單狀態帶入 DLV (已交貨) 或 PCNF (部分確認)，量產入庫大功告成！",
                    "caution": "成型鞋廠與底廠完工自動入庫；QM 在此階段無成品 FQC 檢驗批，千萬不要盲目查 QM 批號！"
                }
            ]
        },
        {
            "id": "scene_cancel_conf",
            "title": "【場景 10】報工錯誤取消反沖銷 / MES 重複報工查核循序 (CO13)",
            "category": "完工報工",
            "icon": "🔙",
            "desc": "現場輸入錯誤產量（如多打一個零）、工時誤填或 MES 介面重複拋轉時，嚴禁打負數報工，必須依循 CO13 反沖銷標準 SOP。",
            "steps": [
                {
                    "step_num": 1,
                    "tcode": "ZPP017A",
                    "name": "查詢 MES 介面日誌 (ZPPL017)",
                    "role": "生管 / IT",
                    "action": "若懷疑重複拋轉，至 ZPP017A 查詢當天 Table ZPPL017 日誌，按『工單確認號 + 計數器』排序檢視。",
                    "output": "掌握 MES 介面實際拋轉紀錄與時間印記。",
                    "caution": "比對 COOIS 確認清單，若存在於 COOIS 但不在 ZPPL017 成功 Log 中，即為異常單據。"
                },
                {
                    "step_num": 2,
                    "tcode": "COOIS",
                    "name": "查得欲撤銷行之確認號 (Confirmation No.) 與計數器",
                    "role": "生管 (PP)",
                    "action": "進入 COOIS，清單選擇『確認』，輸入工單號與當天日期，找到誤報工的那一筆確認號與計數器數值。",
                    "output": "記下確認號與計數器，作為 CO13 沖銷之唯一定位鍵。",
                    "caution": "嚴禁在確認畫面再次輸入負數良品試圖沖銷，系統將視為新增報工引發雙重混亂！"
                },
                {
                    "step_num": 3,
                    "tcode": "CO13 / FSH_PCW",
                    "name": "執行生產訂單作業取消確認 (CO13)",
                    "role": "生管 (PP)",
                    "action": "進入 CO13 輸入確認號與計數器，核對欲撤銷之產量與工時後點擊儲存過帳；主檔工單亦可於 FSH_PCW 點擊取消報工按鈕。",
                    "output": "系統自動反向沖銷：產生 Mvt 262 退回倒扣原料、迴轉工時；若已自動入庫，同步觸發 Mvt 102 沖銷成品收貨！",
                    "caution": "沖銷完成後，重新依現場真實產量在 CO11N 重新錄入正確報工數據。"
                }
            ]
        },
        {
            "id": "scene_month_end_teco",
            "title": "【場景 11】工單結案前清理與技術完成 TECO 循序 (月結必備)",
            "category": "清理月結",
            "icon": "🏁",
            "desc": "每月 25 號財務月結關帳前，生管必須完成 COGI 清零 ➔ COOIS 四重稽核 ➔ 打 TECO 關閉預留 ➔ 財務差異計算之標準四步月結閉環。",
            "steps": [
                {
                    "step_num": 1,
                    "tcode": "COGI",
                    "name": "清理失敗物料異動 (必須 100% 歸零)",
                    "role": "生管 / 資材",
                    "action": "生管進 COGI 查詢倒扣失敗清單；通知資材補足儲位庫存後，生管在 COGI 勾選失敗項點擊儲存重新過帳。",
                    "output": "COGI 清單必須 100% 歸零！物料文件過帳完成，無孤兒異動。",
                    "caution": "💥 月結紅線：月結前 COGI 若未歸零，財務將無條件退件，工廠無法進行成本月結！"
                },
                {
                    "step_num": 2,
                    "tcode": "COOIS",
                    "name": "結案前四重深度稽核",
                    "role": "生管 (PP)",
                    "action": "COOIS 依序稽核：1.元件查未發料 (需求數量 > 領料數量)、2.表頭查交付差異 (工單量 vs 交付量)、3.採購申請查 PP02 外協 PO 是否全收貨、4.資材分析表查庫存佔用。",
                    "output": "四重稽核全數確認通過，無應發未發料、無未入庫半成品、無懸掛委外 PO。",
                    "caution": "若有未領料件且確認不需領用，需在工單元件打上最後發貨標記 (Final Issue)。"
                },
                {
                    "step_num": 3,
                    "tcode": "CO03",
                    "name": "工單結算規則 (Settlement Rule) 與利潤中心查核",
                    "role": "生管 / 成本會計",
                    "action": "進 CO03 檢視工單標頭『結算規則』，確認類別為 MAT 或 CTR，比率為 100%，並核對利潤中心有填。",
                    "output": "結算規則健全，防止財務後續 CO88 拋出『無結算規則』或利潤中心遺失錯誤。",
                    "caution": "跨月退料之工單處置：先以 COHV 批次上刪除旗標，無法上刪除旗標者再上 TECO。"
                },
                {
                    "step_num": 4,
                    "tcode": "CO02 / FSH_PCW / COHV",
                    "name": "執行工單技術完成 (TECO)",
                    "role": "生管 (PP)",
                    "action": "單張工單在 CO02 點選『功能 ➔ 限制 ➔ 技術上完成 (TECO)』；批量則於 FSH_PCW 或 COHV 批次執行 TECO。",
                    "output": "工單狀態轉為 TECO，物料預留單 (Reservation) 即刻關閉，庫存額度釋放，不再參與 MRP 運算！",
                    "caution": "狀態打上 TECO 後，系統停止計算在製品 (WIP)，財務方能正式計算生產差異 (Variance)！"
                },
                {
                    "step_num": 5,
                    "tcode": "KKS2 / CO88",
                    "name": "成本差異計算與工單月結損益結算",
                    "role": "成本會計 (CO)",
                    "action": "財務人員執行 KKS2 計算工單實發成本與標準成本收貨金額之價差/量差，並於 CO88 結算過帳損益。",
                    "output": "工單差異結轉入銷貨成本差異科目，工單正式平帳結案，月結閉環完成！",
                    "caution": "未打 TECO 之工單成本全數認定為在製品 (WIP)，會導致當月損益失真。"
                }
            ]
        },
        {
            "id": "scene_packing_vas",
            "title": "【場景 12】包裝工單與 VAS 客製加值服務循序 (ZP04)",
            "category": "工單與排程",
            "icon": "📦",
            "desc": "依訂單國別決定之外箱、鞋撐、吊牌、乾燥劑加值包裝，開立不展階包裝工單 ZP04，領料發料直接結算至重工成本 51110099 之程序。",
            "steps": [
                {
                    "step_num": 1,
                    "tcode": "CO07",
                    "name": "開立無物料包裝工單 (ZP04)",
                    "role": "生管 (PP)",
                    "action": "進入 CO07，訂單類型輸入 ZP04 (包裝工單)，輸入生產工廠與銷售訂單號碼，系統建立無物料表頭之包裝單。",
                    "output": "產生 ZP04 包裝工單，不展 BOM 結構，結算規則自動指派至銷貨成本-重工科目 G/L 51110099。",
                    "caution": "ZP04 不展階、不進 MES 輪次、不入庫 (皆為 🔴 X)，領料即消耗！"
                },
                {
                    "step_num": 2,
                    "tcode": "ZPP020",
                    "name": "開立包裝領料單",
                    "role": "生管 (PP)",
                    "action": "在 ZPP020 單據類別選擇『包裝工單 (ZP04)』，輸入包裝工單號，產出包裝材料領料單。",
                    "output": "產生外箱、鞋撐、條碼標籤之領料單，並透過 ZPP021 列印條碼單。",
                    "caution": "包裝材料直接向包材倉領用，與正單鞋身原料隔離。"
                },
                {
                    "step_num": 3,
                    "tcode": "ZMM046 / MIGO 261",
                    "name": "倉庫包裝材料檢貨發料過帳",
                    "role": "倉管 (MM)",
                    "action": "倉庫人員掃描條碼過帳，背景執行 Mvt 261，材料扣帳並直接計入重工成本科目 51110099。",
                    "output": "包材發料完畢，產線裝箱打包隨成品出貨，ZP04 結案完成！",
                    "caution": "包裝工單無須入庫，直接隨大貨整箱拉至成品倉交運。"
                }
            ]
        },
        {
            "id": "scene_order_transfer",
            "title": "【場景 13】業務訂單挪單 (SIT-626) 對生管工單因應處置循序",
            "category": "工單與排程",
            "icon": "🔀",
            "desc": "業務因急單或船期將銷售訂單 SO-A 挪至 SO-B 時，生管依工單實發狀態區分『尚未發料作廢刪單』vs『已發料庫存轉撥或換料』處置程序。",
            "steps": [
                {
                    "step_num": 1,
                    "tcode": "VA02",
                    "name": "業務發起訂單挪單異動 (SIT-626)",
                    "role": "業務 (SD)",
                    "action": "業務在 VA02 進行訂單挪單作業，將原客戶訂單 SO-A 需求移轉至目標訂單 SO-B，並通知生管窗口。",
                    "output": "業務系統挪單完成，發送通知給現場生管與資材。",
                    "caution": "生管接獲挪單通知後，切勿直接在工單按刪除鍵！先查發料狀態！"
                },
                {
                    "step_num": 2,
                    "tcode": "COOIS",
                    "name": "查核原工單是否已有實體領料扣帳",
                    "role": "生管 (PP)",
                    "action": "進入 COOIS (元件清單)，核對原工單各料件之『領料數量 (RESB-ENMNG)』是否大於 0。",
                    "output": "判定分支：若領料數量 = 0 走分支 A；若領料數量 > 0 走分支 B。",
                    "caution": "若已領料卻強行刪工單，會造成帳面預留與實物嚴重脫鉤，後台出現孤兒資料！"
                },
                {
                    "step_num": 3,
                    "tcode": "狀況 A: ZPP020 ➔ CO02",
                    "name": "分支 A 處置 (尚未發料 RESB-ENMNG = 0)",
                    "role": "生管 (PP)",
                    "action": "1. 至 ZPP020 依原 SO 整張作廢刪除領料單。<br>2. 進 CO02 修改工單表頭之『卸貨點 (Unloading Point)』為新 SO-B；或於 COHV 標記刪除後由新 SO 重新轉開工單。",
                    "output": "舊單領料單作廢，工單順利綁定新 SO-B，無殘留項次。",
                    "caution": "必須先刪領料單再改工單表頭卸貨點，順序不可顛倒！"
                },
                {
                    "step_num": 4,
                    "tcode": "狀況 B: MIGO 311 或 ZPP024+ZPP010",
                    "name": "分支 B 處置 (已實體發料 RESB-ENMNG > 0)",
                    "role": "生管 / 倉管",
                    "action": "• 材料完全共用：透過 MB21 / MIGO 311 辦理專案庫存移轉，業務轉撥至新 SO。<br>• 規格不同需抽換：開 ZPP024 退料單 ➔ 倉管 ZMM047 (Mvt 262) 退料歸零 ➔ 生管 ZPP010 改單換料 ➔ 重開領料單。",
                    "output": "已發材料精確回沖或合法移轉，無重工月結差額，安全閉環！",
                    "caution": "已實體發料工單嚴禁直接刪單，必須 100% 透過 262 退庫或 311 移轉！"
                }
            ]
        }
    ]
}

# Write JSON

json_path = os.path.join(DATA_DIR, "pp_knowledge.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(knowledge_data, f, ensure_ascii=False, indent=2)

# Write JS wrapper for file:// offline direct launch
js_path = os.path.join(DATA_DIR, "knowledge_loader.js")
with open(js_path, "w", encoding="utf-8") as f:
    f.write("// Auto-generated SAP PP Knowledge Base for offline & standalone use\n")
    f.write("window.PP_KNOWLEDGE = ")
    json.dump(knowledge_data, f, ensure_ascii=False, indent=2)
    f.write(";\n")

print(f"Successfully generated:\n- {json_path}\n- {js_path}")
print(f"Stats: {len(knowledge_data['issues'])} issues, {len(knowledge_data['order_types'])} order types, {len(knowledge_data['control_keys'])} control keys, {len(knowledge_data['tcodes'])} T-Codes.")
