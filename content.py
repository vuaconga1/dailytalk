"""Reusable teaching bank. No learner-specific data belongs in shared audio."""
DOMAINS = {"daily": "Giao tiếp hằng ngày", "office": "Công việc văn phòng", "travel": "Du lịch"}
QUESTIONS = [
    ("She ___ English every day.", ["study", "studies", "studying"], 1),
    ("Choose the reply: How are you?", ["I'm fine, thank you.", "I'm thirty.", "It's blue."], 0),
    ("I usually go to work ___ bus.", ["on", "in", "by"], 2),
    ("Yesterday, we ___ a meeting.", ["have", "had", "having"], 1),
    ("Could you ___ that again, please?", ["repeat", "repeated", "repeating"], 0),
    ("If it rains, we ___ indoors.", ["stayed", "would stayed", "will stay"], 2),
    ("I've worked here ___ 2022.", ["since", "for", "during"], 0),
    ("Choose a polite request.", ["Give me now.", "Could you send me the details?", "You send yesterday."], 1),
]

# title, domain, terms, frame, dialogue, role, goal
ROWS = [
 ("Hello, nice to meet you", "common", [("name","tên"),("work","làm việc"),("meet","gặp")], "My name is … / I work in …", ["Hello! What's your name?", "My name is Linh. Nice to meet you.", "Nice to meet you too. Where do you work?", "I work in an office."], "a new acquaintance", "Tự giới thiệu tên và công việc trong 3 câu."),
 ("My daily routine", "common", [("wake up","thức dậy"),("usually","thường"),("finish","kết thúc")], "I usually … at …", ["What time do you wake up?", "I usually wake up at six.", "When do you finish work?", "I finish at five."], "a friend asking about your day", "Kể giờ thức dậy và hai hoạt động thường ngày."),
 ("Ask for clarification", "common", [("repeat","nhắc lại"),("slowly","chậm rãi"),("mean","có nghĩa là")], "Could you …, please?", ["Please meet me at the main entrance.", "Could you repeat that, please?", "At the main entrance, near the cafe.", "Thank you. Could you speak more slowly?"], "a helpful English-speaking colleague", "Xin nhắc lại và nói chậm hơn một cách lịch sự."),
 ("Make an appointment", "common", [("available","rảnh"),("appointment","cuộc hẹn"),("tomorrow","ngày mai")], "Are you available …? / Could we meet …?", ["Are you available tomorrow?", "Yes. What time would you like to meet?", "Could we meet at ten?", "Ten is fine. See you then."], "someone arranging an appointment", "Đề xuất và xác nhận giờ hẹn."),
 ("Talk about preferences", "common", [("prefer","thích hơn"),("quiet","yên tĩnh"),("because","bởi vì")], "I prefer … because …", ["Do you prefer a quiet place or a busy place?", "I prefer a quiet place.", "Why do you prefer it?", "Because I can talk with my friends."], "a friend planning an outing", "Nêu sở thích và một lý do."),
 ("Ask for help", "common", [("help","giúp đỡ"),("find","tìm"),("near","gần")], "Could you help me …?", ["Excuse me. Could you help me find the station?", "Of course. It's near the park.", "Is it far from here?", "No. It's a five-minute walk."], "a helpful local person", "Nhờ giúp đỡ và hỏi thêm một thông tin."),
 ("Order a drink", "daily", [("orange juice","nước cam"),("small","nhỏ"),("large","lớn")], "I'd like …, please.", ["Hello. What would you like?", "I'd like orange juice, please.", "Small or large?", "Small, please. Thank you."], "a cafe server", "Gọi đồ uống và chọn kích cỡ."),
 ("At the supermarket", "daily", [("bread","bánh mì"),("price","giá"),("bag","túi")], "How much is …? / Do you have …?", ["Excuse me. Do you have bread?", "Yes. It's over here.", "How much is it?", "It's two dollars."], "a supermarket assistant", "Hỏi vị trí sản phẩm và giá tiền."),
 ("Weekend plans", "daily", [("weekend","cuối tuần"),("visit","thăm"),("plan","kế hoạch")], "I'm going to …", ["What are you going to do this weekend?", "I'm going to visit my family.", "When are you going?", "On Saturday morning."], "a friend discussing weekend plans", "Nói kế hoạch cuối tuần và thời gian."),
 ("Describe your home", "daily", [("room","phòng"),("kitchen","bếp"),("comfortable","thoải mái")], "There is … / There are …", ["What's your home like?", "It's small but comfortable.", "How many rooms are there?", "There are three rooms and a kitchen."], "a friend curious about your home", "Mô tả nhà bằng ba câu đơn giản."),
 ("Start a work conversation", "office", [("team","nhóm"),("project","dự án"),("responsible for","phụ trách")], "I'm responsible for …", ["Welcome to the team. What do you do?", "I'm responsible for customer support.", "Which project are you working on?", "I'm working on our new service."], "a new colleague", "Giới thiệu vai trò và công việc đang làm."),
 ("Arrange a meeting", "office", [("meeting","cuộc họp"),("schedule","lên lịch"),("confirm","xác nhận")], "Could we schedule …?", ["Could we schedule a meeting for Tuesday?", "Sure. Is ten o'clock good for you?", "Yes. Could you send me the details?", "Of course. I'll send them today."], "a colleague arranging a meeting", "Đặt giờ họp và yêu cầu thông tin."),
 ("Give a progress update", "office", [("complete","hoàn thành"),("deadline","hạn chót"),("need","cần")], "I've completed … / I still need to …", ["How is the project going?", "I've completed the first part.", "What do you still need to do?", "I still need to check the report."], "a supportive team leader", "Nói việc đã làm và việc còn cần hoàn thành."),
 ("Request information", "office", [("details","chi tiết"),("document","tài liệu"),("send","gửi")], "Could you send me …?", ["Could you send me the document?", "Certainly. When do you need it?", "By this afternoon, please.", "No problem. I'll send it before lunch."], "a colleague helping with documents", "Yêu cầu tài liệu và xác nhận thời hạn."),
 ("Check in at a hotel", "travel", [("reservation","đặt phòng"),("passport","hộ chiếu"),("breakfast","bữa sáng")], "I have a reservation under …", ["Good evening. How can I help you?", "I have a reservation under Nguyen.", "May I see your passport, please?", "Of course. What time is breakfast?"], "a hotel receptionist", "Thông báo đặt phòng và hỏi giờ ăn sáng."),
 ("Ask for directions", "travel", [("turn left","rẽ trái"),("straight ahead","thẳng phía trước"),("station","nhà ga")], "How do I get to …?", ["Excuse me. How do I get to the station?", "Go straight ahead and turn left.", "Is it near the museum?", "Yes. It's opposite the museum."], "a local giving directions", "Hỏi đường và xác nhận một địa điểm."),
 ("Order a meal", "travel", [("menu","thực đơn"),("rice","cơm"),("bill","hóa đơn")], "Could I have …, please?", ["Could I have the menu, please?", "Of course. Here you are.", "I'd like rice and vegetables, please.", "Certainly. Would you like some water?"], "a restaurant server", "Gọi món và trả lời câu hỏi của người phục vụ."),
 ("At the airport", "travel", [("flight","chuyến bay"),("gate","cổng lên máy bay"),("boarding pass","thẻ lên máy bay")], "Where is …? / Here is my …", ["May I see your boarding pass?", "Yes. Here is my boarding pass.", "Your flight leaves from gate twelve.", "Thank you. Where is gate twelve?"], "an airport staff member", "Hỏi cổng lên máy bay và đưa thông tin cơ bản."),
]
LESSONS = {}
for i, (title, domain, terms, frame, dialogue, role, goal) in enumerate(ROWS, 1):
    key = f"L{i:02d}"
    LESSONS[key] = dict(id=key, title=title, domain=domain, vocabulary=[dict(word=w, meaning=m) for w,m in terms], frame=frame, dialogue=dialogue, role=role, goal=goal, version=1)

def question_list():
    return [dict(id=i, text=q[0], options=q[1]) for i,q in enumerate(QUESTIONS)]

def grade(answers):
    if not isinstance(answers, list) or len(answers)!=len(QUESTIONS) or any(type(a) is not int or a not in range(3) for a in answers):
        raise ValueError("Vui lòng trả lời đầy đủ 8 câu.")
    score=sum(a==q[2] for a,q in zip(answers,QUESTIONS))
    return dict(score=score,total=8,level="foundation" if score<4 else "developing",note="Chỉ là sàng lọc ngữ pháp/đọc hiểu cơ bản, chưa đánh giá nghe và phát âm; không phải chứng nhận CEFR.")

def default_plan(profile):
    selected=[k for k,v in LESSONS.items() if v['domain'] in ('common',profile['domain'])]
    return dict(goal=f"Tự tin sử dụng tiếng Anh trong {DOMAINS[profile['domain']].lower()} qua 30 tình huống thực tế.", days=[dict(day=d+1, lesson_id=selected[d%len(selected)], focus="Ôn và ứng dụng độc lập" if d>=len(selected) else "Làm quen và thực hành") for d in range(30)])
