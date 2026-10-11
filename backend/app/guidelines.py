"""Guidelines shown to the officer. Only facts from the cited sources — nothing invented."""

SOURCES = {
    "fpj": {
        "label": "Free Press Journal, 26 Feb 2026 — NGT ban pushes BMC to build 4 dedicated ghats",
        "url": "https://www.freepressjournal.in/amp/bhopal/mp-news-idol-immersion-to-shift-from-lakes-to-safer-sites-ngt-ban-pushes-bmc-to-build-4-dedicated-ghats",
    },
    "cpcb2020": {
        "label": "CPCB Revised Guidelines for Idol Immersion, 12 May 2020 (summary: India Water Portal, Oct 2025)",
        "url": "https://www.indiawaterportal.org/faqs/faq-on-idol-immersion-in-india-what-the-law-says-and-where-it-falls-short",
    },
    "cpcb_criteria": {
        "label": "CPCB water quality criteria (designated best use)",
        "url": "https://cpcb.gov.in/water-quality-criteria/",
    },
    "track": {
        "label": "Bhopal Impact Lab 2026 — Track 2 problem statement",
        "url": None,
    },
}

GUIDELINES = [
    {
        "id": "ngt-ban",
        "group": "bhopal",
        "title": "Immersion banned in Upper Lake and Lower Lake",
        "title_hi": "बड़ी झील और छोटी झील में विसर्जन प्रतिबंधित",
        "points": [
            ["Following NGT directions, idol immersion in Upper Lake (Bada Talab) and Lower Lake (Chhota Talab) is completely prohibited.",
             "एनजीटी के निर्देश पर बड़ी झील (बड़ा तालाब) और छोटी झील (छोटा तालाब) में मूर्ति विसर्जन पूरी तरह प्रतिबंधित है।"],
            ["The ban was enforced during last year's Ganesh Chaturthi and Navratri too.",
             "यह प्रतिबंध पिछले वर्ष गणेश चतुर्थी और नवरात्रि में भी लागू था।"],
        ],
        "source": "fpj",
    },
    {
        "id": "new-ghats",
        "group": "bhopal",
        "title": "BMC is building 4 dedicated immersion ghats",
        "title_hi": "बीएमसी 4 समर्पित विसर्जन घाट बना रहा है",
        "points": [
            ["Under construction: Malikhedi and inside the Barkatullah University campus. Finalised: Sanjeev Nagar and Neelbadh.",
             "निर्माणाधीन: मालीखेड़ी और बरकतउल्ला विश्वविद्यालय परिसर। तय: संजीव नगर और नीलबड़।"],
            ["Current immersion arrangements: Bairagarh, Malikhedi, Prempura, Khatlapura, Hathaikheda Dam and Arch Bridge ghats.",
             "वर्तमान विसर्जन व्यवस्था: बैरागढ़, मालीखेड़ी, प्रेमपुरा, खटलापुरा, हथाईखेड़ा डैम और आर्च ब्रिज घाट।"],
            ["Arch Bridge ghat and the four new sites have no MPPCB readings in the 2023–2025 reports — they are not in this tool's ranking.",
             "आर्च ब्रिज घाट और चारों नए स्थलों की 2023–2025 रिपोर्ट में कोई एमपीपीसीबी रीडिंग नहीं है — इसलिए ये रैंकिंग में नहीं हैं।"],
        ],
        "source": "fpj",
    },
    {
        "id": "materials",
        "group": "cpcb",
        "title": "Idol materials",
        "title_hi": "मूर्ति की सामग्री",
        "points": [
            ["Eco-friendly materials such as natural clay and natural dyes.", "प्राकृतिक मिट्टी और प्राकृतिक रंग जैसी पर्यावरण-अनुकूल सामग्री।"],
            ["No single-use plastic or thermocol in idols or decorations.", "मूर्ति या सजावट में सिंगल-यूज़ प्लास्टिक और थर्मोकोल नहीं।"],
        ],
        "source": "cpcb2020",
    },
    {
        "id": "sites",
        "group": "cpcb",
        "title": "Immersion sites",
        "title_hi": "विसर्जन स्थल",
        "points": [
            ["Use artificial ponds where feasible.", "जहाँ संभव हो, कृत्रिम तालाबों का उपयोग करें।"],
            ["Pre-designated immersion zones with barricading and shallow depths.", "बैरिकेडिंग और कम गहराई वाले पूर्व-निर्धारित विसर्जन क्षेत्र।"],
        ],
        "source": "cpcb2020",
    },
    {
        "id": "cleanup",
        "group": "cpcb",
        "title": "Collection and clean-up",
        "title_hi": "संग्रह और सफ़ाई",
        "points": [
            ["Segregate flowers and offerings (nirmalya) and other residuals; clean up after immersion.",
             "फूल व पूजन सामग्री (निर्माल्य) और अन्य अवशेष अलग करें; विसर्जन के बाद सफ़ाई करें।"],
            ["The CPCB 2020 text is guidance, made binding through state and city orders.",
             "सीपीसीबी 2020 दिशानिर्देश सलाहकारी हैं; राज्य और नगर आदेशों से बाध्यकारी बनते हैं।"],
        ],
        "source": "cpcb2020",
    },
    {
        "id": "standard",
        "group": "tool",
        "title": "Standard used in this tool: CPCB Class B (outdoor bathing)",
        "title_hi": "इस टूल का मानक: सीपीसीबी क्लास B (बाहरी स्नान)",
        "points": [
            ["DO at least 5 mg/l · BOD at most 3 mg/l · pH 6.5 to 8.5.", "DO कम से कम 5 mg/l · BOD अधिकतम 3 mg/l · pH 6.5 से 8.5।"],
            ["Total coliform is also a Class B limit, but the visarjan reports do not test it.",
             "टोटल कोलीफॉर्म भी क्लास B की सीमा है, पर विसर्जन रिपोर्ट में इसकी जाँच नहीं है।"],
        ],
        "source": "cpcb_criteria",
    },
]

CHECKLIST = [
    ["Oxygen pumps at ghats where oxygen fell below 5 in 2024–2025", "जिन घाटों पर 2024–2025 में ऑक्सीजन 5 से कम रही, वहाँ ऑक्सीजन पंप"],
    ["Collect flowers and offerings separately, and clean up after immersion at high-waste ghats (CPCB 2020)", "ज़्यादा गंदगी वाले घाटों पर फूल व पूजा सामग्री अलग इकट्ठा करें, और विसर्जन के बाद सफ़ाई करें (CPCB 2020)"],
    ["Ask MPPCB to test the water before, during and a week after at ghats with missing data", "जिन घाटों का डेटा नहीं, वहाँ MPPCB से पहले, दौरान और हफ़्ते बाद पानी की जाँच"],
    ["Barricades and shallow immersion areas; artificial ponds where possible", "बैरिकेड और कम गहरे विसर्जन क्षेत्र; जहाँ हो सके, कृत्रिम तालाब"],
    ["No immersion in Upper Lake or Lower Lake (NGT order)", "बड़ी झील या छोटी झील में विसर्जन नहीं (NGT आदेश)"],
]


def guidelines() -> dict:
    return {
        "event": {"name": "Durga visarjan", "name_hi": "दुर्गा विसर्जन", "date": "2026-10-20"},
        "items": GUIDELINES,
        "checklist": CHECKLIST,
        "sources": SOURCES,
    }
