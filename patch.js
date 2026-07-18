const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(
  "const [user, setUser] = useState<User | null>(null);",
  "const [user, setUser] = useState<User | null>({ uid: 'local', email: 'admin@local' } as any);"
);
code = code.replace(
  "const [userProfile, setUserProfile] = useState<UserProfile | null>(null);",
  "const [userProfile, setUserProfile] = useState<UserProfile | null>({ fullName: 'المدير العام', role: 'admin' } as any);"
);
code = code.replace(
  "const [loading, setLoading] = useState(true);",
  "const [loading, setLoading] = useState(false);"
);
fs.writeFileSync('src/App.tsx', code);
